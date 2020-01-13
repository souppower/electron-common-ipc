/// <reference types='electron' />

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import * as Client from '../IpcBusClient';
import * as Bridge from './IpcBusBridge';
import { IpcBusCommand } from '../IpcBusCommand';
// import { IpcBusTransportNet } from '../node/IpcBusTransportNet';
import { IpcBusRendererBridge } from './IpcBusRendererBridge';
import { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusConnectorImpl } from '../IpcBusConnectorImpl';
import { IpcBusConnectorNet } from '../node/IpcBusConnectorNet';

class IpcBusBridgeConnectorMain extends IpcBusConnectorImpl {
    protected _bridge: IpcBusBridgeImpl;

    constructor(contextType: Client.IpcBusProcessType, bridge: IpcBusBridgeImpl) {
       super(contextType);
       this._bridge = bridge;
    }

    ipcHandshake(options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        const handshake: IpcBusConnector.Handshake = {
            process: this.process
        }
        return Promise.resolve(handshake);
    }

    ipcShutdown(options: Client.IpcBusClient.CloseOptions): Promise<void> {
        return Promise.resolve();
    }

    ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        this._bridge._onMainMessageReceived(ipcBusCommand, args);
    }

    get client(): IpcBusConnector.Client {
        return this._client;
    }
}

class IpcBusBridgeConnectorNet extends IpcBusConnectorNet {
    protected _bridge: IpcBusBridgeImpl;

    constructor(contextType: Client.IpcBusProcessType, bridge: IpcBusBridgeImpl) {
       super(contextType);
       this._bridge = bridge;
    }

    // ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
    //     this._bridge._onNetMessage(ipcBusCommand, args);
    // }

    get client(): IpcBusConnector.Client {
        return this._client;
    }
}


// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeImpl implements Bridge.IpcBusBridge {
    protected _mainConnector: IpcBusBridgeConnectorMain;
    protected _netConnector: IpcBusBridgeConnectorNet;
    protected _rendererConnector: IpcBusRendererBridge;

    protected _connected: boolean;
    private _packetOut: IpcPacketBuffer;

    constructor(contextType: Client.IpcBusProcessType) {
        this._connected = false;

        this._packetOut = new IpcPacketBuffer();
        this._mainConnector = new IpcBusBridgeConnectorMain(contextType, this);
        this._netConnector = new IpcBusBridgeConnectorNet(contextType, this);
        this._rendererConnector = new IpcBusRendererBridge(this);
    }

    protected _reset(endSocket: boolean) {
        this._connected = false;
        // super._reset(endSocket);
    }

    get mainConnector(): IpcBusConnector {
        return this._mainConnector;
    }

    // IpcBusBridge API
    connect(arg1: Bridge.IpcBusBridge.ConnectOptions | string | number, arg2?: Bridge.IpcBusBridge.ConnectOptions | string, arg3?: Bridge.IpcBusBridge.ConnectOptions): Promise<void> {
        // To manage re-entrance
        this._rendererConnector.connect();
        const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
        if (!this._connected) {
            if ((options.port != null) || (options.path != null)) {
                this._connected = true;
                // this._brokerChannels.clear();
                // return super.ipcConnect(null, { peerName: `IpcBusBridge`, ...options })
                //     .then(() => {
                //         super.ipcPost(this._peer, IpcBusCommand.Kind.BridgeConnect, null);
                //         this.bridgeAddChannels(this._subscriptions.getChannels());
                //         IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
                //     })
                //     .catch(err => {
                //         this._connected = false;
                //     });
            }
        }
        else {
            if ((options.port == null) && (options.path == null)) {
                // return super.ipcClose(null, options);
            }
        }
        return Promise.resolve();
    }

    close(options?: Bridge.IpcBusBridge.CloseOptions): Promise<void> {
        this._rendererConnector.close();
        if (this._connected) {
            // super.ipcPost(this._peer, IpcBusCommand.Kind.BridgeClose, null);
            // return super.ipcClose(null, options);
        }
        return Promise.resolve();
    }

    // // Not exposed
    // queryState(): Object {
    //     const queryStateResult: Object[] = [];
    //     this._subscriptions.forEach((connData, channel) => {
    //         connData.peerRefCounts.forEach((peerRefCount) => {
    //             queryStateResult.push({ channel: channel, peer: peerRefCount.peer, count: peerRefCount.refCount });
    //         });
    //     });
    //     return queryStateResult;
    // }

    _onRendererMessagedReceived(webContents: Electron.WebContents, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        this._mainConnector.client.onConnectorBufferReceived(null, ipcBusCommand, rawContent);
    }

    // This is coming from the Electron Main Process (Electron ipc)
    // =================================================================================================
    _onMainMessageReceived(ipcBusCommand: IpcBusCommand, args?: any[]) {
        if (args) {
            this._packetOut.serializeArray([ipcBusCommand, args]);
        }
        else {
            this._packetOut.serializeArray([ipcBusCommand]);
        }
        const rawContent = this._packetOut.getRawContent();
        this._rendererConnector.onConnectorBufferReceived(null, ipcBusCommand, rawContent);
    }

    // // This is coming from the Bus broker (socket)
    // // =================================================================================================
    // _onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
    //     switch (ipcBusCommand.kind) {
    //         case IpcBusCommand.Kind.AddBrokerChannels: {
    //             const channels: string[] = ipcPacketBuffer.parseArrayAt(1);
    //             channels.forEach(channel => {
    //                 this._brokerChannels.add(channel);
    //             });
    //             break;
    //         }
    //         case IpcBusCommand.Kind.RemoveBrokerChannels: {
    //             const channels: string[] = ipcPacketBuffer.parseArrayAt(1);
    //             channels.forEach(channel => {
    //                 this._brokerChannels.delete(channel);
    //             });
    //             break;
    //         }
    //         default: {
    //             const rawContent = ipcPacketBuffer.getRawContent();
    //             return this._onCommonMessage('broker', null, ipcBusCommand, rawContent);
    //             break;
    //         }
    //     }
    // }

    // _onCommonMessage(origin: 'broker'| 'renderer'| 'main', sender: IpcBusSender, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
    //     switch (ipcBusCommand.kind) {
    //         case IpcBusCommand.Kind.SendMessage: {
    //             IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
    //             if (ipcBusCommand.request) {
    //                 if (origin === 'renderer') {
    //                     this._subscriptions.setRequestChannel(ipcBusCommand.request.replyChannel, sender, ipcBusCommand.peer);
    //                 }
    //                 if (origin === 'broker') {
    //                     this._brokerChannels.add(ipcBusCommand.request.replyChannel);
    //                 }
    //             }
    //             this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
    //                 connData.conn.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, rawContent);
    //             });
    //             if (origin !== 'main') {
    //                 this._mainTransport._onConnectorBufferReceived(undefined, ipcBusCommand, rawContent);
    //             }
    //             if (origin !== 'broker') {
    //                 if (this._brokerChannels.has(ipcBusCommand.channel)) {
    //                     super.ipcPostBuffer(rawContent.buffer);
    //                 }
    //             }
    //             break;
    //         }
                
    //         case IpcBusCommand.Kind.RequestResponse: {
    //             IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
    //             const connData = this._subscriptions.getRequestChannel(ipcBusCommand.request.replyChannel);
    //             if (connData) {
    //                 this._subscriptions.deleteRequestChannel(ipcBusCommand.request.replyChannel);
    //                 connData.conn.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, rawContent);
    //             }
    //             if (origin !== 'main') {
    //                 this._mainTransport._onConnectorBufferReceived(undefined, ipcBusCommand, rawContent);
    //             }
    //             if (origin !== 'broker') {
    //                 if (this._brokerChannels.delete(ipcBusCommand.request.replyChannel)) {
    //                     super.ipcPostBuffer(rawContent.buffer);
    //                 }
    //             }
    //             break;
    //         }

    //         case IpcBusCommand.Kind.RequestClose:
    //             this._subscriptions.deleteRequestChannel(ipcBusCommand.request.replyChannel);
    //             if (this._brokerChannels.has(ipcBusCommand.request.channel)) {
    //                 super.ipcPostBuffer(rawContent.buffer);
    //             }
    //             break;

    //         default:
    //             if (origin !== 'broker') {
    //                 this._onAdminMessage(sender, ipcBusCommand);
    //             }
    //             break;
    //     }
    // }

    // // Common Electron Process/s
    // // =================================================================================================
    // _onAdminMessage(sender: IpcBusSender, ipcBusCommand: IpcBusCommand): boolean {
    //     switch (ipcBusCommand.kind) {
    //         case IpcBusCommand.Kind.Connect:
    //             return true;

    //         case IpcBusCommand.Kind.Close:
    //             this._subscriptions.removePeer(sender, ipcBusCommand.peer);
    //             return true;

    //         case IpcBusCommand.Kind.AddChannelListener:
    //             this._subscriptions.addRef(ipcBusCommand.channel, sender, ipcBusCommand.peer);
    //             return true;

    //         case IpcBusCommand.Kind.RemoveChannelAllListeners:
    //             this._subscriptions.releaseAll(ipcBusCommand.channel, sender, ipcBusCommand.peer);
    //             return true;

    //         case IpcBusCommand.Kind.RemoveChannelListener:
    //             this._subscriptions.release(ipcBusCommand.channel, sender, ipcBusCommand.peer);
    //             return true;

    //         case IpcBusCommand.Kind.RemoveListeners:
    //             this._subscriptions.removePeer(sender, ipcBusCommand.peer);
    //             return true;
    //     }
    //     return false;
    // }

}

