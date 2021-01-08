/// <reference types='electron' />

// import * as semver from 'semver';
import { IpcPacketBuffer, IpcPacketBufferCore, IpcPacketBufferList } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import type * as Client from '../IpcBusClient';
import type * as Bridge from './IpcBusBridge';
import { IpcBusCommand } from '../IpcBusCommand';

import { IpcBusRendererBridge } from './IpcBusRendererBridge';
import { IpcBusTransportSocketBridge } from './IpcBusSocketBridge';
import { IpcBusBridgeConnectorMain, IpcBusBridgeTransportMain } from './IpcBusMainBridge'; 
import type { IpcBusTransport } from '../IpcBusTransport'; 
import { IpcBusBrokerBridge } from './IpcBusBrokerBridge';
import { IpcBusConnectorSocket } from '../node/IpcBusConnectorSocket';

export interface IpcBusBridgeClient {
    getChannels(): string[];
    hasChannel(channel: string): boolean;

    broadcastConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void>;
    broadcastClose(options?: Client.IpcBusClient.CloseOptions): Promise<void>;

    broadcastBuffers(ipcBusCommand: IpcBusCommand, buffers: Buffer[]): void;
    // broadcastArgs(ipcBusCommand: IpcBusCommand, args: any[]): void;
    broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): void;
    broadcastContent(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawData): void;
}

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeImpl implements Bridge.IpcBusBridge {
    protected _mainTransport: IpcBusBridgeTransportMain;
    protected _socketTransport: IpcBusBridgeClient;
    protected _rendererConnector: IpcBusBridgeClient;
    protected _peer: Client.IpcBusPeer;

    // private _noSerialization: boolean;

    constructor(contextType: Client.IpcBusProcessType) {
        // this._noSerialization = semver.gte(process.versions.electron, '8.0.0');
        
        this._peer = { 
            id: `t_${contextType}.${IpcBusUtils.CreateUniqId()}`,
            name: 'IPCBusBrige',
            process: {
                type: contextType,
                pid: process.pid
            }
        };
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
        return this._rendererConnector.broadcastConnect(options)
        .then(() => {
            if (this._socketTransport == null) {
                if ((options.port != null) || (options.path != null)) {
                    if (options.server) {
                        this._socketTransport = new IpcBusBrokerBridge('main', this);
                    }
                    else {
                        const connector = new IpcBusConnectorSocket('main');
                        this._socketTransport = new IpcBusTransportSocketBridge(connector, this);
                    }
                    return this._socketTransport.broadcastConnect(options)
                    .catch(err => {
                        this._socketTransport = null;
                    });
                }
            }
            else {
                if ((options.port == null) && (options.path == null)) {
                    const socketTransport = this._socketTransport;
                    this._socketTransport = null;
                    return socketTransport.broadcastClose();
                }
            }
            return Promise.resolve();
        });
    }

    close(options?: Bridge.IpcBusBridge.CloseOptions): Promise<void> {
        return this._rendererConnector.broadcastClose()
        .then(() => {
            if (this._socketTransport) {
                const socketTransport = this._socketTransport;
                this._socketTransport = null;
                return socketTransport.broadcastClose();
            }
            return Promise.resolve();
        });
    }

    getChannels(): string[] {
        const rendererChannels = this._rendererConnector.getChannels();
        const mainChannels = this._mainTransport.getChannels();
        return rendererChannels.concat(mainChannels);
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
    _onRendererChannelChanged(ipcBusCommand: IpcBusCommand) {
        if (this._socketTransport) {
            ipcBusCommand.peer = this._peer;
            ipcBusCommand.kind = (IpcBusCommand.KindBridgePrefix + ipcBusCommand.kind) as IpcBusCommand.Kind;
            const packet = new IpcPacketBuffer();
            packet.serialize([ipcBusCommand]);
            this._socketTransport.broadcastPacket(ipcBusCommand, packet);
        }
    }

    _onRendererContentReceived(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawData) {
        this._mainTransport.onConnectorContentReceived(ipcBusCommand, rawContent);
        this._socketTransport && this._socketTransport.broadcastContent(ipcBusCommand, rawContent);
    }

    // _onRendererArgsReceived(ipcBusCommand: IpcBusCommand, args: any[]) {
    //     this._mainTransport.onConnectorArgsReceived(ipcBusCommand, args);
    //     const hasNetChannel = this._netTransport && this._netTransport.hasChannel(ipcBusCommand.channel);
    //     // Prevent serializing for nothing !
    //     if (hasNetChannel) {
    //         this._packet.serialize([ipcBusCommand, args]);
    //         this._netTransport.broadcastBuffer(ipcBusCommand, this._packet.buffer);
    //         this._packet.reset();
    //     }
    // }

    // This is coming from the Electron Main Process (Electron main ipc)
    // =================================================================================================
    _onMainChannelChanged(ipcBusCommand: IpcBusCommand) {
        if (this._socketTransport) {
            ipcBusCommand.peer = this._peer;
            ipcBusCommand.kind = (IpcBusCommand.KindBridgePrefix + ipcBusCommand.kind) as IpcBusCommand.Kind;
            const packet = new IpcPacketBuffer();
            packet.serialize([ipcBusCommand]);
            this._socketTransport.broadcastPacket(ipcBusCommand, packet);
        }
    }

    _onMainMessageReceived(ipcBusCommand: IpcBusCommand, args?: any[]) {
        // if (this._noSerialization) {
        //     this._rendererConnector.broadcastArgs(ipcBusCommand, args);
        //     this._netTransport.broadcastArgs(ipcBusCommand, args);
        // }
        // else {
            const hasRendererChannel = this._rendererConnector.hasChannel(ipcBusCommand.channel);
            const hasSocketChannel = this._socketTransport && this._socketTransport.hasChannel(ipcBusCommand.channel);
            // Prevent serializing for nothing !
            if (hasRendererChannel || hasSocketChannel) {
                const packet = new IpcPacketBufferList();
                if (args) {
                    packet.serialize([ipcBusCommand, args]);
                }
                else {
                    packet.serialize([ipcBusCommand]);
                }
                hasSocketChannel && this._socketTransport.broadcastPacket(ipcBusCommand, packet);
                // End with renderer if have to compress
                hasRendererChannel && this._rendererConnector.broadcastPacket(ipcBusCommand, packet);
            }
        // }
    }

    // This is coming from the Bus broker (socket)
    // =================================================================================================
    _onNetMessageReceived(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore) {
        this._mainTransport.onConnectorPacketReceived(ipcBusCommand, ipcPacketBufferCore);
        this._rendererConnector.broadcastPacket(ipcBusCommand, ipcPacketBufferCore);
    }

    _onNetClosed() {
        this._socketTransport = null;
    }
}

