/// <reference types='electron' />

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import * as Client from '../IpcBusClient';
import * as Bridge from './IpcBusBridge';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusTransportNet } from '../IpcBusTransportNet';
import { IPCBUS_TRANSPORT_RENDERER_CONNECT, IPCBUS_TRANSPORT_RENDERER_COMMAND, IPCBUS_TRANSPORT_RENDERER_EVENT } from '../IpcBusTransportWindow';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeImpl extends IpcBusTransportNet implements Bridge.IpcBusBridge {
    private _ipcMain: any;

    protected _ipcBusPeers: Map<string, Client.IpcBusPeer>;
    protected _subscriptions: IpcBusUtils.ChannelConnectionMap<Electron.WebContents>;
    protected _brokerChannels: Set<string>;

    protected _connected: boolean;

    constructor(contextType: Client.IpcBusProcessType) {
        super(contextType);

        this._ipcMain = require('electron').ipcMain;

        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<Electron.WebContents>('IPCBus:Bridge', true);
        this._subscriptions.on('channel-added', channel => {
            this._connected && this.bridgeAddChannels([channel]);
        });
        this._subscriptions.on('channel-removed', channel => {
            this._connected && this.bridgeRemoveChannels([channel]);
        });

        this._ipcBusPeers = new Map<string, Client.IpcBusPeer>();
        this._brokerChannels = new Set<string>();

        this._onRendererMessage = this._onRendererMessage.bind(this);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onRendererMessage);
    }

    protected _reset(endSocket: boolean) {
        this._brokerChannels.clear();
        this._connected = false;
        super.ipcSend(IpcBusCommand.Kind.BridgeClose, null);
        super._reset(endSocket);
    }

    private bridgeAddChannels(channels: string[]) {
        const ipcBusCommand: IpcBusCommand = {
            kind: IpcBusCommand.Kind.BridgeAddChannels,
            channel: '',
            peer: this.peer
        };
        super.ipcPostCommand(ipcBusCommand, channels);
    }

    private bridgeRemoveChannels(channels: string[]) {
        const ipcBusCommand: IpcBusCommand = {
            kind: IpcBusCommand.Kind.BridgeRemoveChannels,
            channel: '',
            peer: this.peer
        };
        super.ipcPostCommand(ipcBusCommand, channels);
    }

    // IpcBusBridge API
    connect(arg1: Bridge.IpcBusBridge.ConnectOptions | string | number, arg2?: Bridge.IpcBusBridge.ConnectOptions | string, arg3?: Bridge.IpcBusBridge.ConnectOptions): Promise<void> {
        if (!this._connected) {
            this._connected = true;
            this._brokerChannels.clear();
            const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
            if ((options.port == null && options.path == null)) {
                return Promise.reject('Wrong options');
            }
            return super.ipcConnect({ peerName: `IpcBusBridge`, ...options })
                .then(() => {
                    super.ipcSend(IpcBusCommand.Kind.BridgeConnect, null);
                    this.bridgeAddChannels(this._subscriptions.getChannels());
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
                })
                .catch(err => {
                    this._connected = false;
                });
        }
        return Promise.resolve();
    }

    close(options?: Bridge.IpcBusBridge.CloseOptions): Promise<void> {
        if (this._connected) {
            this._connected = false;
            return super.ipcClose(options);
        }
        return Promise.resolve();
    }

    // Not exposed
    queryState(): Object {
        const queryStateResult: Object[] = [];
        this._subscriptions.forEach((connData, channel) => {
            connData.peerIds.forEach((peerIdRefCount) => {
                queryStateResult.push({ channel: channel, peer: this._ipcBusPeers.get(peerIdRefCount.peerId), count: peerIdRefCount.refCount });
            });
        });
        return queryStateResult;
    }

    protected _onCommandSendMessage(ipcBusCommand: IpcBusCommand, args: any[]) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
        this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
            connData.conn.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, args);
        });
    }

    protected _onCommandRequestdMessage(ipcBusCommand: IpcBusCommand, args: any[]) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
        this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
            connData.conn.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, args);
        });
    }

    protected _onCommandRequestResponse(ipcBusCommand: IpcBusCommand, args: any[]) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
        const webContents = this._subscriptions.getRequestChannel(ipcBusCommand.request.replyChannel);
        if (webContents) {
            this._subscriptions.deleteRequestChannel(ipcBusCommand.request.replyChannel);
            webContents.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, args);
        }
    }

    // This is coming from the Socket broker
    protected _onCommandReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.BrokerAddChannels: {
                const channels: string[] = ipcPacketBuffer.parseArrayAt(1);
                channels.forEach(channel => {
                    this._brokerChannels.add(channel);
                });
                return;
            }
            case IpcBusCommand.Kind.BrokerRemoveChannels: {
                const channels: string[] = ipcPacketBuffer.parseArrayAt(1);
                channels.forEach(channel => {
                    this._brokerChannels.delete(channel);
                });
                return;
            }
        }
        return super._onCommandReceived(ipcBusCommand, ipcPacketBuffer);
    }

    private _rendererCleanUp(webContents: Electron.WebContents): void {
        this._subscriptions.releaseConnection(webContents);
    }

    private _completePeerInfo(webContents: Electron.WebContents, ipcBusPeer: Client.IpcBusPeer): void {
        let peerName = `${ipcBusPeer.process.type}-${webContents.id}`;
        ipcBusPeer.process.wcid = webContents.id;
        // Hidden function, may disappear
        try {
            ipcBusPeer.process.rid = (webContents as any).getProcessId();
            peerName += `-r${ipcBusPeer.process.rid}`;
        }
        catch (err) {
            ipcBusPeer.process.rid = -1;
        }
        // >= Electron 1.7.1
        try {
            ipcBusPeer.process.pid = webContents.getOSProcessId();
            peerName += `_${ipcBusPeer.process.pid}`;
        }
        catch (err) {
            // For backward we fill pid with webContents id
            ipcBusPeer.process.pid = webContents.id;
        }
        ipcBusPeer.name = peerName;
    }

    private _onConnect(webContents: Electron.WebContents, ipcBusCommand: IpcBusCommand, args: any[]): void {
        const ipcBusPeer = ipcBusCommand.peer;
        this._ipcBusPeers.set(ipcBusPeer.id, ipcBusPeer);

        this._completePeerInfo(webContents, ipcBusPeer);

        webContents.addListener('destroyed', () => {
            this._rendererCleanUp(webContents);
            this._ipcBusPeers.delete(ipcBusPeer.id);
        });

        ipcBusPeer.name = args[0] || ipcBusPeer.name;

        // We get back to the webContents
        // - to confirm the connection
        // - to provide peerName and id/s
        // BEWARE, if the message is sent before webContents is ready, it will be lost !!!!
        if (webContents.getURL() && !webContents.isLoadingMainFrame()) {
            webContents.send(IPCBUS_TRANSPORT_RENDERER_CONNECT, ipcBusPeer);
        }
        else {
            webContents.on('did-finish-load', () => {
                webContents.send(IPCBUS_TRANSPORT_RENDERER_CONNECT, ipcBusPeer);
            });
        }
    }

    private _onDisconnect(webContents: Electron.WebContents, ipcBusCommand: IpcBusCommand, args: any[]): void {
        const ipcBusPeer = ipcBusCommand.peer;
        this._ipcBusPeers.delete(ipcBusPeer.id);
        this._rendererCleanUp(webContents);
    }

    protected _onRendererMessage(event: any, ipcBusCommand: IpcBusCommand, args: any[]) {
        const webContents = event.sender;
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.BridgeConnect:
                this._onConnect(webContents, ipcBusCommand, args);
                break;

            case IpcBusCommand.Kind.BridgeDisconnect:
            case IpcBusCommand.Kind.BridgeClose:
                this._onDisconnect(webContents, ipcBusCommand, args);
                break;

            case IpcBusCommand.Kind.BridgeAddChannelListener:
                this._subscriptions.addRef(ipcBusCommand.channel, webContents, ipcBusCommand.peer.id);
                break;

            case IpcBusCommand.Kind.BridgeRemoveChannelAllListeners:
                this._subscriptions.releaseAll(ipcBusCommand.channel, webContents, ipcBusCommand.peer.id);
                break;

            case IpcBusCommand.Kind.BridgeRemoveChannelListener:
                this._subscriptions.release(ipcBusCommand.channel, webContents, ipcBusCommand.peer.id);
                break;

            case IpcBusCommand.Kind.BridgeRemoveListeners:
                this._rendererCleanUp(webContents);
                break;

            case IpcBusCommand.Kind.BridgeRequestMessage:
                this._subscriptions.setRequestChannel(ipcBusCommand.request.replyChannel, webContents);
                this._onCommandRequestdMessage(ipcBusCommand, args);
                if (this._brokerChannels.has(ipcBusCommand.channel)) {
                    super.ipcPostCommand(ipcBusCommand, args);
                }
                break;

            case IpcBusCommand.Kind.BridgeSendMessage:
                this._onCommandSendMessage(ipcBusCommand, args);
                if (this._brokerChannels.has(ipcBusCommand.channel)) {
                    super.ipcPostCommand(ipcBusCommand, args);
                }
                break;
                
            case IpcBusCommand.Kind.BridgeRequestResponse:
                this._onCommandRequestResponse(ipcBusCommand, args);
                if (this._brokerChannels.has(ipcBusCommand.request.channel)) {
                    super.ipcPostCommand(ipcBusCommand, args);
                }
                break;

            case IpcBusCommand.Kind.BridgeRequestCancel:
                this._subscriptions.deleteRequestChannel(ipcBusCommand.request.replyChannel);
                if (this._brokerChannels.has(ipcBusCommand.request.channel)) {
                    super.ipcPostCommand(ipcBusCommand, args);
                }
                break;

            default:
                break;
        }
    }
}

