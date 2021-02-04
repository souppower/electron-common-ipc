/// <reference types='electron' />

import type { IpcPacketBuffer, IpcPacketBufferCore } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import type * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusTransportImpl } from '../IpcBusTransportImpl';
import type { IpcBusTransport } from '../IpcBusTransport';
import type { IpcBusConnector } from '../IpcBusConnector';
import { ChannelConnectionRef, ChannelConnectionMap } from '../IpcBusChannelMap';

import type { IpcBusBridgeImpl } from './IpcBusBridgeImpl';

const PeerName = 'NetBridge';

export class IpcBusTransportSocketBridge extends IpcBusTransportImpl {
    protected _bridge: IpcBusBridgeImpl;
    protected _subscriptions: ChannelConnectionMap<string, string>;
    private _connectionRef: ChannelConnectionRef<string, string>;

    constructor(connector: IpcBusConnector, bridge: IpcBusBridgeImpl) {
        super(connector);
        this._bridge = bridge;
        
        this._connectionRef = {
            key: 'IPCBus:NetBridge',
            conn: 'IPCBus:NetBridge'
        }
        this._subscriptions = new ChannelConnectionMap<string, string>(this._connectionRef.key);
    }

    broadcastConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return super.connect(null, { ...options, peerName: PeerName })
        .then((peer) => {
            this._peer = peer;
            const channels = this._bridge.getChannels();
            this._postCommand({
                peer: this._peer,
                kind: IpcBusCommand.Kind.BridgeConnect,
                channel: undefined,
                channels
            });
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
        });
    }

    broadcastClose(options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        this._postCommand({
            peer: this._peer,
            kind: IpcBusCommand.Kind.BridgeClose,
            channel: ''
        });
        return super.close(null, options);
    }


    // Come from the main bridge: main or renderer
    broadcastBuffers(ipcBusCommand: IpcBusCommand, buffers: Buffer[]): void {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.BridgeAddChannelListener:
            case IpcBusCommand.Kind.BridgeRemoveChannelListener:
                this._connector.postBuffers(buffers);
                break

            case IpcBusCommand.Kind.SendMessage:
            case IpcBusCommand.Kind.RequestClose:
                if (this.hasChannel(ipcBusCommand.channel)) {
                    this._connector.postBuffers(buffers);
                }
                break;
            case IpcBusCommand.Kind.RequestResponse: {
                const connData = this._subscriptions.popResponseChannel(ipcBusCommand.request.replyChannel);
                if (connData) {
                    this._connector.postBuffers(buffers);
                }
                break;
            }
        }
    }

    broadcastArgs(ipcBusCommand: IpcBusCommand, args: any[]): void {
        // if (this.hasChannel(ipcBusCommand.channel)) {
        //     ipcBusCommand.bridge = true;
        //     this._packet.serialize([ipcBusCommand, args]);
        //     this.broadcastBuffer(ipcBusCommand, this._packet.buffer);
        // }
    }

    broadcastRawData(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawData): void {
        if (rawContent.buffer) {
            this.broadcastBuffers(ipcBusCommand, [rawContent.buffer]);
        }
        else {
            this.broadcastBuffers(ipcBusCommand, rawContent.buffers);
        }
    }

    broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): void {
        this.broadcastBuffers(ipcBusCommand, ipcPacketBufferCore.buffers);
    }

    hasChannel(channel: string): boolean {
        return this._subscriptions.hasChannel(channel);
    }

    getChannels(): string[] {
        return this._subscriptions.getChannels();
    }

    addChannel(client: IpcBusTransport.Client, channel: string, count?: number): void {
        throw 'not implemented';
    }

    removeChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean): void {
        // call when closing the transport
    }

    protected onMessageReceived(local: boolean, ipcBusCommand: IpcBusCommand, args: any[]): void {
        throw 'not implemented';
    }

    // protected sendMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
    //     throw 'not implemented';
    // }

    protected _postMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        throw 'not implemented';
    }

    onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): boolean {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.AddChannelListener:
                this._subscriptions.addRef(ipcBusCommand.channel, this._connectionRef, ipcBusCommand.peer);
                break;
            case IpcBusCommand.Kind.RemoveChannelListener:
                this._subscriptions.release(ipcBusCommand.channel, this._connectionRef.key, ipcBusCommand.peer);
                break;
            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                this._subscriptions.releaseAll(ipcBusCommand.channel, this._connectionRef.key, ipcBusCommand.peer);
                break;
            case IpcBusCommand.Kind.RemoveListeners:
                this._subscriptions.removePeer(ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.SendMessage:
                if (ipcBusCommand.request) {
                    this._subscriptions.pushResponseChannel(ipcBusCommand.request.replyChannel, this._connectionRef, ipcBusCommand.peer);
                }
                this._bridge._onNetMessageReceived(ipcBusCommand, ipcPacketBufferCore);
                break;
            case IpcBusCommand.Kind.RequestClose:
                this._subscriptions.popResponseChannel(ipcBusCommand.request.replyChannel);
                this._bridge._onNetMessageReceived(ipcBusCommand, ipcPacketBufferCore);
                break;
            default:
                this._bridge._onNetMessageReceived(ipcBusCommand, ipcPacketBufferCore);
                break;
        }
        return true;
    }

    onConnectorContentReceived(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawData): boolean {
        throw 'not implemented';
    }

    onConnectorArgsReceived(ipcBusCommand: IpcBusCommand, args: any[]): boolean {
        throw 'not implemented';
    }

    onConnectorShutdown(): void {
        super.onConnectorShutdown();
        this._subscriptions.clear();
        this._bridge._onNetClosed();
    }
}

