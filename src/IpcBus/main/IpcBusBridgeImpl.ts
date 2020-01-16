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
        switch(ipcBusCommand.kind) {
            case IpcBusCommand.Kind.AddChannels: {
                const channels = args[0];
                this._bridge._onMainAddChannels(channels);
                break;
            }
            case IpcBusCommand.Kind.RemoveChannels: {
                const channels = args[0];
                this._bridge._onMainRemoveChannels(channels);
                break;
            }
    
            case IpcBusCommand.Kind.SendMessage:
            case IpcBusCommand.Kind.RequestResponse:
            case IpcBusCommand.Kind.RequestClose:
                this._bridge._onMainMessageReceived(ipcBusCommand, args);
                break;
        }
    }

    get client(): IpcBusConnector.Client {
        return this._client;
    }
}

class IpcBusBridgeConnectorNet extends IpcBusConnectorNet implements IpcBusConnector.Client {
    protected _bridge: IpcBusBridgeImpl;

    constructor(contextType: Client.IpcBusProcessType, bridge: IpcBusBridgeImpl) {
       super(contextType);
       this._bridge = bridge;
       this.addClient(this);
    }

    onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void {
        this._bridge._onNetMessageReceived(ipcBusCommand, ipcPacketBuffer);
    }

    onConnectorBufferReceived(__ignore__: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): void {
    }

    onConnectorClosed(): void {
    }

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
        return this._rendererConnector.connect()
        .then(() => {
            const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
            if (!this._connected) {
                if ((options.port != null) || (options.path != null)) {
                    this._connected = true;
                    // this._brokerChannels.clear();
                    return this._netConnector.ipcHandshake(options)
                        .then((handshake) => {
                            // this._netConnector.ipcPostCommand({
                            //     kind: IpcBusCommand.Kind.BridgeConnect,
                            //     peer: this._peer
                            // },                            this.bridgeAddChannels(this._subscriptions.getChannels());
                            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
                        })
                        .catch(err => {
                            this._connected = false;
                        });
                }
            }
            else {
                if ((options.port == null) && (options.path == null)) {
                    return this._netConnector.ipcShutdown();
                }
            }
            return Promise.resolve();
        });
    }

    close(options?: Bridge.IpcBusBridge.CloseOptions): Promise<void> {
        return this._rendererConnector.close()
        .then(() => {
            if (this._connected) {
                // super.ipcPost(this._peer, IpcBusCommand.Kind.BridgeClose, null);
                return this._netConnector.ipcShutdown(options);
            // return super.ipcClose(null, options);
            }
            return Promise.resolve();
        });
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
            // this._netConnector.onConnectorBufferReceived
        }

    _onRendererAddChannels(channels: string[]) {
    }

    _onRendererRemoveChannels(channels: string[]) {
    }

    // This is coming from the Electron Main Process (Electron ipc)
    // =================================================================================================
    _onMainMessageReceived(ipcBusCommand: IpcBusCommand, args?: any[]) {
        // Prevent serializing for main
        // if (this._rendererConnector.hasChannel(ipcBusCommand.channel) || this._rendererConnector.hasRequestChannel(ipcBusCommand.channel)) {
            if (args) {
                this._packetOut.serializeArray([ipcBusCommand, args]);
            }
            else {
                this._packetOut.serializeArray([ipcBusCommand]);
            }
            const rawContent = this._packetOut.getRawContent();
            this._rendererConnector.onConnectorBufferReceived(null, ipcBusCommand, rawContent);
            this._netConnector.onConnectorBufferReceived(null, ipcBusCommand, rawContent);
        // }
    }

    _onMainAddChannels(channels: string[]) {
    }

    _onMainRemoveChannels(channels: string[]) {
    }


    // This is coming from the Bus broker (socket)
    // =================================================================================================
    _onNetMessageReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        this._mainConnector.client.onConnectorPacketReceived(ipcBusCommand, ipcPacketBuffer);
        this._rendererConnector.onConnectorPacketReceived(ipcBusCommand, ipcPacketBuffer);
    }
}

