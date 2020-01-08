/// <reference types='electron' />

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import * as Client from '../IpcBusClient';
import * as Bridge from './IpcBusBridge';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusTransportNet } from '../node/IpcBusTransportNet';
import { IpcBusSender } from '../IpcBusTransport';
import { 
    IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, 
    IPCBUS_TRANSPORT_RENDERER_COMMAND, 
    IPCBUS_TRANSPORT_RENDERER_EVENT } from '../renderer/IpcBusTransportWindow';

export const IPCBUS_TRANSPORT_BRIDGE_REQUEST_INSTANCE = 'ECIPC:IpcBusBridge:RequestInstance';
export const IPCBUS_TRANSPORT_BRIDGE_BROADCAST_INSTANCE = 'ECIPC:IpcBusBridge:BroadcastInstance';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeImpl extends IpcBusTransportNet implements Bridge.IpcBusBridge {
    private _ipcMain: Electron.IpcMain;

    protected _subscriptions: IpcBusUtils.ChannelConnectionMap<IpcBusSender>;
    protected _brokerChannels: Set<string>;

    protected _connected: boolean;

    constructor(contextType: Client.IpcBusProcessType) {
        super(contextType);

        this._ipcMain = require('electron').ipcMain;
        this._connected = false;

        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<IpcBusSender>('IPCBus:Bridge', true);
        this._subscriptions.on('channel-added', channel => {
            this._connected && this.bridgeAddChannels([channel]);
        });
        this._subscriptions.on('channel-removed', channel => {
            this._connected && this.bridgeRemoveChannels([channel]);
        });

        this._brokerChannels = new Set<string>();

        // callbacks
        this._onRendererMessage = this._onRendererMessage.bind(this);
        this._onMainConnect = this._onMainConnect.bind(this);

        this._ipcMain.emit(IPCBUS_TRANSPORT_BRIDGE_BROADCAST_INSTANCE, { sender: null }, this);
    }

    protected _reset(endSocket: boolean) {
        this._brokerChannels.clear();
        this._connected = false;
        super.ipcPost(IpcBusCommand.Kind.BridgeClose, null);
        super._reset(endSocket);
    }

    private bridgeAddChannels(channels: string[]) {
        const ipcBusCommand: IpcBusCommand = {
            kind: IpcBusCommand.Kind.AddBridgeChannels,
            channel: '',
            peer: this.peer
        };
        super.ipcPostCommand(ipcBusCommand, channels);
    }

    private bridgeRemoveChannels(channels: string[]) {
        const ipcBusCommand: IpcBusCommand = {
            kind: IpcBusCommand.Kind.RemoveBridgeChannels,
            channel: '',
            peer: this.peer
        };
        super.ipcPostCommand(ipcBusCommand, channels);
    }

    // IpcBusBridge API
    connect(arg1: Bridge.IpcBusBridge.ConnectOptions | string | number, arg2?: Bridge.IpcBusBridge.ConnectOptions | string, arg3?: Bridge.IpcBusBridge.ConnectOptions): Promise<void> {
        // To manage re-entrance
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onRendererMessage);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onRendererMessage);
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_BRIDGE_REQUEST_INSTANCE, this._onMainConnect);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_BRIDGE_REQUEST_INSTANCE, this._onMainConnect);

        const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
        if (!this._connected) {
            if ((options.port != null) || (options.path != null)) {
                this._connected = true;
                this._brokerChannels.clear();
                return super.ipcConnect(null, { peerName: `IpcBusBridge`, ...options })
                    .then(() => {
                        super.ipcPost(IpcBusCommand.Kind.BridgeConnect, null);
                        this.bridgeAddChannels(this._subscriptions.getChannels());
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
                    })
                    .catch(err => {
                        this._connected = false;
                    });
            }
        }
        else {
            if ((options.port == null) && (options.path == null)) {
                return super.ipcClose(null, options);
            }
        }
        return Promise.resolve();
    }

    close(options?: Bridge.IpcBusBridge.CloseOptions): Promise<void> {
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onRendererMessage);
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_BRIDGE_REQUEST_INSTANCE, this._onMainConnect);
        if (this._connected) {
            return super.ipcClose(null, options);
        }
        return Promise.resolve();
    }

    // Not exposed
    queryState(): Object {
        const queryStateResult: Object[] = [];
        this._subscriptions.forEach((connData, channel) => {
            connData.peerRefCounts.forEach((peerRefCount) => {
                queryStateResult.push({ channel: channel, peer: peerRefCount.peer, count: peerRefCount.refCount });
            });
        });
        return queryStateResult;
    }

    // This is coming from the Bus broker (socket)
    // =================================================================================================
    protected _onCommandPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.AddBrokerChannels: {
                const channels: string[] = ipcPacketBuffer.parseArrayAt(1);
                channels.forEach(channel => {
                    this._brokerChannels.add(channel);
                });
                break;
            }
            case IpcBusCommand.Kind.RemoveBrokerChannels: {
                const channels: string[] = ipcPacketBuffer.parseArrayAt(1);
                channels.forEach(channel => {
                    this._brokerChannels.delete(channel);
                });
                break;
            }
            case IpcBusCommand.Kind.SendMessage: {
                if (ipcBusCommand.request) {
                    this._brokerChannels.add(ipcBusCommand.request.replyChannel);
                }
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
                    connData.conn.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, ipcPacketBuffer.buffer);
                });
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
                const connData = this._subscriptions.getRequestChannel(ipcBusCommand.request.replyChannel);
                if (connData) {
                    this._subscriptions.deleteRequestChannel(ipcBusCommand.request.replyChannel);
                    connData.conn.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, ipcPacketBuffer.buffer);
                }
                break;
            }
            case IpcBusCommand.Kind.RequestCancel:
                this._subscriptions.deleteRequestChannel(ipcBusCommand.request.replyChannel);
                this._brokerChannels.delete(ipcBusCommand.request.replyChannel);
                break;
        }
    }

    // This is coming from the Electron Renderer Proces/s (Electron ipc)
    // =================================================================================================
    private _completePeerInfo(webContents: Electron.WebContents, ipcBusPeer: Client.IpcBusPeer): void {
        ipcBusPeer.process.wcid = webContents.id;
        // Following functions are not implemented in all Electrons
        try {
            ipcBusPeer.process.rid = webContents.getProcessId();
        }
        catch (err) {
            ipcBusPeer.process.rid = -1;
        }
        try {
            ipcBusPeer.process.pid = webContents.getOSProcessId();
        }
        catch (err) {
            // For backward we fill pid with webContents id
            ipcBusPeer.process.pid = webContents.id;
        }
    }

    private _onRendererHandshake(webContents: Electron.WebContents, ipcBusCommand: IpcBusCommand): void {
        const ipcBusPeer = ipcBusCommand.peer;
        this._completePeerInfo(webContents, ipcBusPeer);

        // if we have several clients within the same webcontents, the callback may be called several times !
        webContents.addListener('destroyed', () => {
            this._subscriptions.removeConnection(webContents);
        });
        // We get back to the webContents
        // - to confirm the connection
        // - to provide id/s
        // BEWARE, if the message is sent before webContents is ready, it will be lost !!!!
        if (webContents.getURL() && !webContents.isLoadingMainFrame()) {
            webContents.send(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, ipcBusPeer);
        }
        else {
            webContents.on('did-finish-load', () => {
                webContents.send(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, ipcBusPeer);
            });
        }
    }

    _onRendererMessage(event: any, ipcBusCommand: IpcBusCommand, buffer: Buffer) {
        const webContents: Electron.WebContents = event.sender;
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.Handshake:
                this._onRendererHandshake(webContents, ipcBusCommand);
                break;
            default :
                this._onCommonMessage(webContents, ipcBusCommand, buffer);
                break;
        }
    }

    // This is coming from the Electron Main Process (Electron ipc)
    // =================================================================================================
    _onMainConnect(event: any, replyChannel: string) {
        this._ipcMain.emit(replyChannel, { sender: null }, this);
    }

    _onMainMessage(sender: IpcBusSender, ipcBusCommand: IpcBusCommand, buffer: Buffer) {
        this._onCommonMessage(sender, ipcBusCommand, buffer);
    }

    // Common Electron Process/s
    // =================================================================================================
    _onAdminMessage(sender: IpcBusSender, ipcBusCommand: IpcBusCommand): boolean {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.Connect:
                return true;

            case IpcBusCommand.Kind.Close:
                this._subscriptions.removePeer(sender, ipcBusCommand.peer);
                return true;

            case IpcBusCommand.Kind.AddChannelListener:
                this._subscriptions.addRef(ipcBusCommand.channel, sender, ipcBusCommand.peer);
                return true;

            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                this._subscriptions.releaseAll(ipcBusCommand.channel, sender, ipcBusCommand.peer);
                return true;

            case IpcBusCommand.Kind.RemoveChannelListener:
                this._subscriptions.release(ipcBusCommand.channel, sender, ipcBusCommand.peer);
                return true;

            case IpcBusCommand.Kind.RemoveListeners:
                this._subscriptions.removePeer(sender, ipcBusCommand.peer);
                return true;
        }
        return false;
    }

    _onCommonMessage(sender: IpcBusSender, ipcBusCommand: IpcBusCommand, buffer: Buffer) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                if (ipcBusCommand.request) {
                    this._subscriptions.setRequestChannel(ipcBusCommand.request.replyChannel, sender, ipcBusCommand.peer);
                }
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
                    connData.conn.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, buffer);
                });
                if (this._brokerChannels.has(ipcBusCommand.channel)) {
                    super.ipcPostBuffer(buffer);
                }
                break;
            }
                
            case IpcBusCommand.Kind.RequestResponse: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
                const connData = this._subscriptions.getRequestChannel(ipcBusCommand.request.replyChannel);
                if (connData) {
                    this._subscriptions.deleteRequestChannel(ipcBusCommand.request.replyChannel);
                    connData.conn.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, buffer);
                }
                if (this._brokerChannels.delete(ipcBusCommand.request.replyChannel)) {
                    super.ipcPostBuffer(buffer);
                }
                break;
            }

            case IpcBusCommand.Kind.RequestCancel:
                this._subscriptions.deleteRequestChannel(ipcBusCommand.request.replyChannel);
                if (this._brokerChannels.has(ipcBusCommand.request.channel)) {
                    super.ipcPostBuffer(buffer);
                }
                break;

            default:
                this._onAdminMessage(sender, ipcBusCommand);
                break;
        }
    }

}

