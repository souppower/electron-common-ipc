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
    broadcastArgs(ipcBusCommand: IpcBusCommand, args: any[]): void;
    broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): void;
    broadcastRawData(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawData): void;
}

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeImpl implements Bridge.IpcBusBridge {
    protected _mainTransport: IpcBusBridgeTransportMain;
    protected _socketTransport: IpcBusBridgeClient;
    protected _rendererConnector: IpcBusBridgeClient;
    protected _peer: Client.IpcBusPeer;

    private _noSerialization: boolean;

    constructor(contextType: Client.IpcBusProcessType) {
        this._noSerialization = true;
        
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

    get noSerialization(): boolean {
        return this._noSerialization;
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


    // This is coming from the Electron Main Process (Electron main ipc)
    // This is coming from the Electron Renderer Process (Electron main ipc)
    // =================================================================================================
    _onBridgeChannelChanged(ipcBusCommand: IpcBusCommand) {
        if (this._socketTransport) {
            ipcBusCommand.peer = this._peer;
            ipcBusCommand.kind = (IpcBusCommand.KindBridgePrefix + ipcBusCommand.kind) as IpcBusCommand.Kind;
            const packet = new IpcPacketBuffer();
            packet.serialize([ipcBusCommand]);
            this._socketTransport.broadcastPacket(ipcBusCommand, packet);
        }
    }

    // This is coming from the Electron Renderer Process (Electron main ipc)
    // =================================================================================================
    _onRendererContentReceived(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawData) {
        this._mainTransport.onConnectorContentReceived(ipcBusCommand, rawContent);
        this._socketTransport && this._socketTransport.broadcastRawData(ipcBusCommand, rawContent);
    }

    _onRendererArgsReceived(ipcBusCommand: IpcBusCommand, args: any[]) {
        this._mainTransport.onConnectorArgsReceived(ipcBusCommand, args);
        const hasSocketChannel = this._socketTransport && this._socketTransport.hasChannel(ipcBusCommand.channel);
        // Prevent serializing for nothing !
        if (hasSocketChannel) {
            const packet = new IpcPacketBufferList();
            if (args) {
                packet.serialize([ipcBusCommand, args]);
            }
            else {
                packet.serialize([ipcBusCommand]);
            }
            this._socketTransport.broadcastPacket(ipcBusCommand, packet);
        }
    }

    _onMainMessageReceived(ipcBusCommand: IpcBusCommand, args?: any[]) {
        if (this._noSerialization) {
            this._rendererConnector.broadcastArgs(ipcBusCommand, args);
            const hasSocketChannel = this._socketTransport && this._socketTransport.hasChannel(ipcBusCommand.channel);
            // Prevent serializing for nothing !
            if (hasSocketChannel) {
                const packet = new IpcPacketBufferList();
                if (args) {
                    packet.serialize([ipcBusCommand, args]);
                }
                else {
                    packet.serialize([ipcBusCommand]);
                }
                this._socketTransport.broadcastPacket(ipcBusCommand, packet);
            }
        }
        else {
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
        }
    }

    // This is coming from the Bus broker (socket)
    // =================================================================================================
    _onNetMessageReceived(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore) {
        if (this._noSerialization) {
            // Unserialize only once
            const args = ipcPacketBufferCore.parseArrayAt(1);
            this._mainTransport.onConnectorArgsReceived(ipcBusCommand, args);
            this._rendererConnector.broadcastArgs(ipcBusCommand, args);
        }
        else {
            this._mainTransport.onConnectorPacketReceived(ipcBusCommand, ipcPacketBufferCore);
            this._rendererConnector.broadcastPacket(ipcBusCommand, ipcPacketBufferCore);
        }
    }

    _onNetClosed() {
        this._socketTransport = null;
    }
}

