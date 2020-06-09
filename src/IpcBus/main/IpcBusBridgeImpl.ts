/// <reference types='electron' />

// import * as semver from 'semver';
import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import * as Client from '../IpcBusClient';
import * as Bridge from './IpcBusBridge';
import { IpcBusCommand } from '../IpcBusCommand';

import { IpcBusRendererBridge } from './IpcBusRendererBridge';
import { IpcBusNetBridge } from './IpcBusNetBridge';
import { IpcBusBridgeConnectorMain, IpcBusBridgeTransportMain } from './IpcBusMainBridge'; 
import { IpcBusTransport } from '../IpcBusTransport'; 
import { IpcBusBrokerBridge } from './IpcBusBrokerBridge';

export interface IpcBusBridgeClient {
    connect(options: Client.IpcBusClient.ConnectOptions): Promise<void>;
    close(options?: Client.IpcBusClient.CloseOptions): Promise<void>;

    hasChannel(channel: string): boolean;
    broadcastBuffer(ipcBusCommand: IpcBusCommand, buffer?: Buffer): void;
    // broadcastArgs(ipcBusCommand: IpcBusCommand, args: any[]): void;
    broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void;
    broadcastContent(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): void;
}

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeImpl implements Bridge.IpcBusBridge {
    protected _mainTransport: IpcBusBridgeTransportMain;
    protected _netTransport: IpcBusBridgeClient;
    protected _rendererConnector: IpcBusBridgeClient;

    // private _noSerialization: boolean;

    constructor(contextType: Client.IpcBusProcessType) {
        // this._noSerialization = semver.gte(process.versions.electron, '8.0.0');
        // this._noSerialization = false;

        const mainConnector = new IpcBusBridgeConnectorMain(contextType, this);
        this._mainTransport = new IpcBusBridgeTransportMain(mainConnector);
        this._rendererConnector = new IpcBusRendererBridge(this);
    }

    get mainTransport(): IpcBusTransport {
        return this._mainTransport;
    }

    // IpcBusBridge API
    connect(arg1: Bridge.IpcBusBridge.ConnectOptions | string | number, arg2?: Bridge.IpcBusBridge.ConnectOptions | string, arg3?: Bridge.IpcBusBridge.ConnectOptions): Promise<void> {
        // To manage re-entrance
        const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
        return this._rendererConnector.connect(options)
        .then(() => {
            if (this._netTransport == null) {
                if ((options.port != null) || (options.path != null)) {
                    if (options.server) {
                        this._netTransport = new IpcBusBrokerBridge('main', this);
                    }
                    else {
                        this._netTransport = new IpcBusNetBridge(this);
                    }
                    return this._netTransport.connect(options)
                    .catch(err => {
                        this._netTransport = null;
                    });
                }
            }
            else {
                if ((options.port == null) && (options.path == null)) {
                    const netTransport = this._netTransport;
                    this._netTransport = null;
                    return netTransport.close();
                }
            }
            return Promise.resolve();
        });
    }

    close(options?: Bridge.IpcBusBridge.CloseOptions): Promise<void> {
        return this._rendererConnector.close()
        .then(() => {
            if (this._netTransport) {
                const netTransport = this._netTransport;
                this._netTransport = null;
                return netTransport.close();
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

    // This is coming from the Electron Renderer Process (Electron main ipc)
    // =================================================================================================
    _onRendererContentReceived(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        this._mainTransport.onConnectorContentReceived(ipcBusCommand, rawContent);
        this._netTransport && this._netTransport.broadcastContent(ipcBusCommand, rawContent);
    }

    // _onRendererArgsReceived(ipcBusCommand: IpcBusCommand, args: any[]) {
    //     this._mainTransport.onConnectorArgsReceived(ipcBusCommand, args);
    //     const hasNetChannel = this._netTransport && this._netTransport.hasChannel(ipcBusCommand.channel);
    //     // Prevent serializing for nothing !
    //     if (hasNetChannel) {
    //         ipcBusCommand.bridge = true;
    //         this._packet.serializeArray([ipcBusCommand, args]);
    //         this._netTransport.broadcastBuffer(ipcBusCommand, this._packet.buffer);
    //         this._packet.reset();
    //     }
    // }

    // This is coming from the Electron Main Process (Electron main ipc)
    // =================================================================================================
    _onMainMessageReceived(ipcBusCommand: IpcBusCommand, args?: any[]) {
        // if (this._noSerialization) {
        //     this._rendererConnector.broadcastArgs(ipcBusCommand, args);
        //     this._netTransport.broadcastArgs(ipcBusCommand, args);
        // }
        // else {
            const hasRendererChannel = this._rendererConnector.hasChannel(ipcBusCommand.channel);
            const hasNetChannel = this._netTransport && this._netTransport.hasChannel(ipcBusCommand.channel);
            // Prevent serializing for nothing !
            if (hasRendererChannel || hasNetChannel) {
                ipcBusCommand.bridge = true;
                const packet = new IpcPacketBuffer();
                packet.serializeArray([ipcBusCommand, args]);
                hasNetChannel && this._netTransport.broadcastBuffer(ipcBusCommand, packet.buffer);
                // End with renderer if have to compress
                hasRendererChannel && this._rendererConnector.broadcastPacket(ipcBusCommand, packet);
            }
        // }
    }

    // This is coming from the Bus broker (socket)
    // =================================================================================================
    _onNetMessageReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        const hasRendererChannel = this._rendererConnector.hasChannel(ipcBusCommand.channel);
        // if (this._noSerialization) {
        //     // Prevent deserializing for nothing !
        //     const hasMainChannel = this._mainTransport.hasChannel(ipcBusCommand.channel);
        //     if (hasRendererChannel || hasMainChannel) {
        //         const args = ipcPacketBuffer.parseArrayAt(1);
        //         hasMainChannel && this._mainTransport.onConnectorArgsReceived(ipcBusCommand, args);
        //      }
        // }
        // else {
            this._mainTransport.onConnectorPacketReceived(ipcBusCommand, ipcPacketBuffer);
            // End with renderer if have to compress
            hasRendererChannel && this._rendererConnector.broadcastPacket(ipcBusCommand, ipcPacketBuffer);
        // }
    }

    _onNetClosed() {
        this._netTransport = null;
    }
}

