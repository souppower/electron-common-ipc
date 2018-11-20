/// <reference types='electron' />

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import * as Client from '../IpcBusClient';
import * as Bridge from './IpcBusBridge';

import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusTransportNode } from '../IpcBusTransportNode';
import { IPCBUS_TRANSPORT_RENDERER_CONNECT, IPCBUS_TRANSPORT_RENDERER_COMMAND, IPCBUS_TRANSPORT_RENDERER_EVENT } from '../IpcBusTransportWindow';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeImpl extends IpcBusClientNode implements Bridge.IpcBusBridge {
    private _ipcMain: any;
    private _onRendererMessageBind: Function;

    protected _ipcBusPeers: Map<string, Client.IpcBusPeer>;
    protected _subscriptions: IpcBusUtils.ChannelConnectionMap<number, Electron.WebContents>;
    protected _requestChannels: Map<string, any>;

    constructor(options: Bridge.IpcBusBridge.CreateOptions) {
        super(options);

        this._ipcMain = require('electron').ipcMain;

        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<number, Electron.WebContents>('IPCBus:Bridge');
        this._requestChannels = new Map<string, any>();
        this._ipcBusPeers = new Map<string, Client.IpcBusPeer>();
        this._onRendererMessageBind = this._onRendererMessage.bind(this);
    }

    protected _reset(endSocket: boolean) {
        if (this._ipcMain.listenerCount(IPCBUS_TRANSPORT_RENDERER_COMMAND) > 0) {
            this._ipcBusPeers.clear();
            this._requestChannels.clear();
            this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onRendererMessageBind);
        }
        super._reset(endSocket);
    }

    // IpcBusBridge API
    start(options?: Bridge.IpcBusBridge.StartOptions): Promise<void> {
        options = options || {};
        return this.ipcConnect({ peerName: `IpcBusBridge`, ...options } )
            .then(() => {
                // Guard against people calling start several times
                if (this._ipcMain.listenerCount(IPCBUS_TRANSPORT_RENDERER_COMMAND) === 0) {
                    this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onRendererMessageBind);
                }
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
            });
    }

    stop(options?: Bridge.IpcBusBridge.StopOptions): Promise<void> {
        return this.ipcClose(options);
    }

    // Not exposed
    queryState(): Object {
        let queryStateResult: Object[] = [];
        this._subscriptions.forEach((connData, channel) => {
            connData.peerIds.forEach((peerIdRefCount) => {
                queryStateResult.push({ channel: channel, peer: this._ipcBusPeers.get(peerIdRefCount.peerId), count: peerIdRefCount.refCount });
            });
        });
        return queryStateResult;
    }

    protected _onCommandReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage:
            case IpcBusCommand.Kind.RequestMessage:
                this._subscriptions.forEachChannel(ipcBusCommand.emit || ipcBusCommand.channel, (connData, channel) => {
                    connData.conn.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, ipcPacketBuffer.buffer);
                });
                break;

            case IpcBusCommand.Kind.RequestResponse:
                const webContents = this._requestChannels.get(ipcBusCommand.request.replyChannel);
                if (webContents) {
                    this._requestChannels.delete(ipcBusCommand.request.replyChannel);
                    webContents.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, ipcPacketBuffer.buffer);
                }
                break;
        }
    }

    private _rendererCleanUp(webContents: Electron.WebContents, webContentsId: number, peerId: string): void {
        this._subscriptions.releaseConnection(webContentsId);
        // ForEach is supposed to support deletion during the iteration !
        this._requestChannels.forEach((webContentsForRequest, channel) => {
            if (webContentsForRequest === webContents) {
                this._requestChannels.delete(channel);
            }
        });
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
        let ipcBusPeer = ipcBusCommand.peer;
        this._ipcBusPeers.set(ipcBusPeer.id, ipcBusPeer);

        this._completePeerInfo(webContents, ipcBusPeer);

        // Have to closure the webContentsId as webContents.id is undefined when destroyed !!!
        let webContentsId = webContents.id;
        webContents.addListener('destroyed', () => {
            this._rendererCleanUp(webContents, webContentsId, ipcBusPeer.id);
            // Simulate the close message
            if (this._ipcBusPeers.delete(ipcBusPeer.id)) {
                this.ipcPostCommand({ kind: IpcBusCommand.Kind.Disconnect, channel: '', peer: ipcBusPeer });
            }
        });

        let packetBuffer = new IpcPacketBuffer();
        packetBuffer.decodeFromBuffer(buffer);
        let args = packetBuffer.parseArrayAt(1);
        ipcBusPeer.name = args[0] || ipcBusPeer.name;

        // We get back to the webContents
        // - to confirm the connection
        // - to provide peerName and id/s
        // BEWARE, if the message is sent before webContents is ready, it will be lost !!!!
        if (webContents.getURL() && !webContents.isLoadingMainFrame()) {
            webContents.send(IPCBUS_TRANSPORT_RENDERER_CONNECT, ipcBusPeer);
            // ipcBusCommand.peer may be changed, the original buffer content is no more up-to-date, we have to rebuild it
            this.ipcPostCommand(ipcBusCommand, args);
        }
        else {
            webContents.on('did-finish-load', () => {
                webContents.send(IPCBUS_TRANSPORT_RENDERER_CONNECT, ipcBusPeer);
                // ipcBusCommand.peer may be, the original buffer content is no more up-to-date, we have to rebuild it
                this.ipcPostCommand(ipcBusCommand, args);
            });
        }
        // webContents.addListener('destroyed', this._lambdaCleanUpHandler);
    }

    private _onDisconnect(webContents: Electron.WebContents, ipcBusCommand: IpcBusCommand, buffer: Buffer): void {
        let ipcBusPeer = ipcBusCommand.peer;
        this._ipcBusPeers.delete(ipcBusPeer.id);

        // We do not close the socket, we just disconnect a peer
        ipcBusCommand.kind = IpcBusCommand.Kind.Disconnect;

        this._rendererCleanUp(webContents, webContents.id, ipcBusPeer.id);

        // ipcBusCommand has been changed, the original buffer content is no more up-to-date, we have to rebuild it
        let packetBuffer = new IpcPacketBuffer();
        packetBuffer.decodeFromBuffer(buffer);
        let args = packetBuffer.parseArrayAt(1);
        this.ipcPostCommand(ipcBusCommand, args);
    }

    protected _onRendererMessage(event: any, ipcBusCommand: IpcBusCommand, buffer: Buffer) {
        const webContents = event.sender;
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.Connect : {
                this._onConnect(webContents, ipcBusCommand, buffer);
                // BEWARE, this 'return' is on purpose.
                return;
            }
            case IpcBusCommand.Kind.Disconnect :
            case IpcBusCommand.Kind.Close : {
                this._onDisconnect(webContents, ipcBusCommand, buffer);
                // BEWARE, this 'return' is on purpose.
                return;
            }
            case IpcBusCommand.Kind.AddChannelListener :
                this._subscriptions.addRef(ipcBusCommand.channel, webContents.id, webContents, ipcBusCommand.peer.id);
                break;

            case IpcBusCommand.Kind.RemoveChannelAllListeners :
                this._subscriptions.releaseAll(ipcBusCommand.channel, webContents.id, ipcBusCommand.peer.id);
                break;

            case IpcBusCommand.Kind.RemoveChannelListener :
                this._subscriptions.release(ipcBusCommand.channel, webContents.id, ipcBusCommand.peer.id);
                break;

            case IpcBusCommand.Kind.RemoveListeners :
                this._rendererCleanUp(webContents, webContents.id, ipcBusCommand.peer.id);
                break;

            case IpcBusCommand.Kind.RequestMessage :
                this._requestChannels.set(ipcBusCommand.request.replyChannel, webContents);
                break;

            case IpcBusCommand.Kind.RequestCancel :
                this._requestChannels.delete(ipcBusCommand.request.replyChannel);
                break;

            default :
                break;
        }
        if (this._socket) {
            this._socket.write(buffer);
        }
    }
}

