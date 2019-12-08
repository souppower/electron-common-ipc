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
    private _onRendererMessageBind: Function;

    protected _ipcBusPeers: Map<string, Client.IpcBusPeer>;
    protected _subscriptions: IpcBusUtils.ChannelConnectionMap<Electron.WebContents>;

    protected _ipcTransport: IpcBusTransportNet;
    protected _connected: boolean;

    constructor() {
        super('main');

        this._ipcMain = require('electron').ipcMain;

        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<Electron.WebContents>('IPCBus:Bridge', false);
        this._ipcBusPeers = new Map<string, Client.IpcBusPeer>();

        this._onRendererMessageBind = this._onRendererMessage.bind(this);
        if (this._ipcMain.listenerCount(IPCBUS_TRANSPORT_RENDERER_COMMAND) === 0) {
            this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onRendererMessageBind);
        }

        // this._subscriptions.on('channel-added', channel => {
        //     this._ipcClient && this._ipcClient.addListener(channel, this._onFakeListener);
        // });
        // this._subscriptions.on('channel-removed', channel => {
        //     this._ipcClient && this._ipcClient.removeListener(channel, this._onFakeListener);
        // });
    }

    // protected _reset(endSocket: boolean) {
    //     if (this._ipcMain.listenerCount(IPCBUS_TRANSPORT_RENDERER_COMMAND) > 0) {
    //         this._ipcBusPeers.clear();
    //         this._subscriptions.clear();
    //         this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onRendererMessageBind);
    //     }
    //     super._reset(endSocket);
    // }

    // IpcBusBridge API
    connect(arg1: Bridge.IpcBusBridge.ConnectOptions | string | number, arg2?: Bridge.IpcBusBridge.ConnectOptions | string, arg3?: Bridge.IpcBusBridge.ConnectOptions): Promise<void> {
        if (!this._connected) {
            this._connected = true;
            const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
            if (options == null) {
                return Promise.reject('Wrong options');
            }
            // super.ipcCallback((channel, ipcBusEvent, ...args) => {
            //     super.emit(channel, ipcBusEvent, ...args);
            // });
            return super.ipcConnect({ peerName: `IpcBusBridge`, ...options })
                .then(() => {
                    super.ipcSend(IpcBusCommand.Kind.BridgeConnect, null);
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
            super.ipcSend(IpcBusCommand.Kind.BridgeClose, null);
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

    protected _onCommandBufferReceived(ipcBusCommand: IpcBusCommand, buffer: Buffer): boolean {
        let handled = false;
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.BridgeSendMessage:
            case IpcBusCommand.Kind.BridgeRequestMessage:
                this._subscriptions.forEachChannel(ipcBusCommand.emit || ipcBusCommand.channel, (connData, channel) => {
                    connData.conn.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, buffer);
                });
                break;

            case IpcBusCommand.Kind.BridgeRequestResponse:
                const webContents = this._subscriptions.getRequestChannel(ipcBusCommand.request.replyChannel);
                if (webContents) {
                    this._subscriptions.deleteRequestChannel(ipcBusCommand.request.replyChannel);
                    webContents.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, buffer);
                    handled = true;
                }
                break;
        }
        return handled;
    }

    protected _onCommandReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        ipcBusCommand.kind = ('B' + ipcBusCommand.kind) as IpcBusCommand.Kind;
        return this._onCommandBufferReceived(ipcBusCommand, ipcPacketBuffer.buffer);
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

    private _onConnect(webContents: Electron.WebContents, ipcBusCommand: IpcBusCommand, buffer: Buffer): void {
        const ipcBusPeer = ipcBusCommand.peer;
        this._ipcBusPeers.set(ipcBusPeer.id, ipcBusPeer);

        this._completePeerInfo(webContents, ipcBusPeer);

        webContents.addListener('destroyed', () => {
            this._rendererCleanUp(webContents);
            this._ipcBusPeers.delete(ipcBusPeer.id);
        });

        const packetBuffer = new IpcPacketBuffer();
        packetBuffer.decodeFromBuffer(buffer);
        const args = packetBuffer.parseArrayAt(1);
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

    private _onDisconnect(webContents: Electron.WebContents, ipcBusCommand: IpcBusCommand, buffer: Buffer): void {
        const ipcBusPeer = ipcBusCommand.peer;
        this._ipcBusPeers.delete(ipcBusPeer.id);
        this._rendererCleanUp(webContents);
    }

    protected _onRendererMessage(event: any, ipcBusCommand: IpcBusCommand, buffer: Buffer) {
        const webContents = event.sender;
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.BridgeConnect:
                this._onConnect(webContents, ipcBusCommand, buffer);
                break;

            case IpcBusCommand.Kind.BridgeDisconnect:
            case IpcBusCommand.Kind.BridgeClose:
                this._onDisconnect(webContents, ipcBusCommand, buffer);
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
                this._onCommandBufferReceived(ipcBusCommand, buffer);
                if (this._connected) {
                    super.ipcPostBuffer(buffer);
                }
                break;

            case IpcBusCommand.Kind.BridgeSendMessage:
                this._onCommandBufferReceived(ipcBusCommand, buffer);
                if (this._connected) {
                    super.ipcPostBuffer(buffer);
                }
                break;

            case IpcBusCommand.Kind.BridgeRequestResponse:
                this._onCommandBufferReceived(ipcBusCommand, buffer);
                if (this._connected) {
                    super.ipcPostBuffer(buffer);
                }
                break;

            case IpcBusCommand.Kind.BridgeRequestCancel:
                this._subscriptions.deleteRequestChannel(ipcBusCommand.request.replyChannel);
                if (this._connected) {
                    super.ipcPostBuffer(buffer);
                }
                break;

            default:
                break;
        }
    }
}

