/// <reference types='electron' />

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusBridgeImpl, IpcBusBridgeClient } from './IpcBusBridgeImpl';
import { IpcBusTransportImpl } from '../IpcBusTransportImpl';
import { IpcBusTransport } from '../IpcBusTransport';
import { IpcBusConnectorNet } from '../node/IpcBusConnectorNet';
import { IpcBusConnector } from '../IpcBusConnector';

const PeerName = 'NetBridge';

class IpcBusTransportNetBridge extends IpcBusTransportImpl {
    protected _bridge: IpcBusBridgeImpl;
    protected _subscriptions: IpcBusUtils.ChannelConnectionMap<string, string>;

    constructor(connector: IpcBusConnector, bridge: IpcBusBridgeImpl) {
        super(connector);
        this._bridge = bridge;

        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<string, string>(
            `IPCBus:${PeerName}`,
            (conn) => conn,
            false
        );

        // this._subscriptions.emitter = true;
        // this._subscriptions.on('channel-added', (channel) => {
        //     const ipcBusCommand = { 
        //         kind: IpcBusCommand.Kind.AddChannelListener,
        //         peer: this._peer,
        //         channel
        //     }
        //     this._bridge._trackAdmin(ipcBusCommand);
        // });
        // this._subscriptions.on('channel-removed', (channel) => {
        //     const ipcBusCommand = { 
        //         kind: IpcBusCommand.Kind.RemoveChannelListener,
        //         peer: this._peer,
        //         channel
        //     }
        //     this._bridge._trackAdmin(ipcBusCommand);
        // });
    }

    connect(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        return super.connect(null, { ...options, peerName: PeerName })
        .then((peer) => {
            this._peer = peer;
            this.postAdmin({
                peer: this._peer,
                kind: IpcBusCommand.Kind.BridgeConnect,
                channel: ''
            });
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
            return peer;
        });
    }

    close(client: IpcBusTransport.Client | null, options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        this.postAdmin({
            peer: this._peer,
            kind: IpcBusCommand.Kind.BridgeClose,
            channel: ''
        });
        return super.close(null, options);
    }

    // hasRequestChannel(channel: string): boolean {
    //     return this._subscriptions.hasChannel(channel);
    // }

    hasChannel(channel: string): boolean {
        return this._subscriptions.hasChannel(channel);
    }

    // getChannels(): string[] {
    //     return this._subscriptions.getChannels();
    // }

    addChannel(client: IpcBusTransport.Client, channel: string, count?: number): void {
        throw 'not implemented';
    }

    removeChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean): void {
        throw 'not implemented';
    }

    protected onMessageReceived(local: boolean, ipcBusCommand: IpcBusCommand, args: any[]): void {
        throw 'not implemented';
    }

    protected postMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        throw 'not implemented';
    }

    broadcastBuffer(ipcBusCommand: IpcBusCommand, buffer?: Buffer): void {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                if (ipcBusCommand.request) {
                    this._subscriptions.setSingleChannel(ipcBusCommand.request.replyChannel, PeerName, ipcBusCommand.peer);
                }
                if (buffer && this.hasChannel(ipcBusCommand.channel)) {
                    this._connector.postBuffer(buffer);
                }
                break;
            }

            case IpcBusCommand.Kind.RequestResponse: {
                const hasChannel = this._subscriptions.removeChannel(ipcBusCommand.request.replyChannel);
                if (buffer && hasChannel) {
                    this._connector.postBuffer(buffer);
                }
                break;
            }

            case IpcBusCommand.Kind.RequestClose:
                const hasChannel = this._subscriptions.removeChannel(ipcBusCommand.request.replyChannel);
                // To inform Broker
                if (buffer && hasChannel) {
                    this._connector.postBuffer(buffer);
                    // log IpcBusLog.Kind.GET_CLOSE_REQUEST
                }
                break;
        }
    }

    onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): boolean {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.AddChannelListener:
                this._subscriptions.addRef(ipcBusCommand.channel, PeerName, ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveChannelListener:
                this._subscriptions.release(ipcBusCommand.channel, PeerName, ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                this._subscriptions.releaseAll(ipcBusCommand.channel, PeerName, ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveListeners:
                this._subscriptions.removePeer(PeerName, ipcBusCommand.peer);
                break;

            default:
                this.broadcastBuffer(ipcBusCommand, null);
                this._bridge._onNetMessageReceived(ipcBusCommand, ipcPacketBuffer);
                break;
        }
        return true;
    }

    onConnectorBufferReceived(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): boolean {
        throw 'not implemented';
    }

    onConnectorShutdown(): void {
        this._bridge._onNetClosed();
    }
}

export class IpcBusNetBridge implements IpcBusBridgeClient {
    protected _bridge: IpcBusBridgeImpl;
    protected _transport: IpcBusTransportNetBridge;
    protected _packet: IpcPacketBuffer;

    constructor(bridge: IpcBusBridgeImpl) {
        this._bridge = bridge;

        this._packet = new IpcPacketBuffer();
        const connector = new IpcBusConnectorNet('main');
        this._transport = new IpcBusTransportNetBridge(connector, bridge);
    }

    connect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return this._transport.connect(null, options)
        .then(() => {});
    }

    close(options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return this._transport.close(null, options);
    }

    hasChannel(channel: string): boolean {
        return this._transport.hasChannel(channel);
    }

    broadcastArgs(ipcBusCommand: IpcBusCommand, args: any[]): void {
        if (this.hasChannel(ipcBusCommand.channel)) {
            ipcBusCommand.bridge = true;
            this._packet.serializeArray([ipcBusCommand, args]);
            this.broadcastBuffer(ipcBusCommand, this._packet.buffer);
        }
    }

    broadcastPacketRaw(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): void {
        this._transport.broadcastBuffer(ipcBusCommand, rawContent.buffer);
    }

    broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void {
        this._transport.broadcastBuffer(ipcBusCommand, ipcPacketBuffer.buffer);
    }

    broadcastBuffer(ipcBusCommand: IpcBusCommand, buffer?: Buffer): void {
        this._transport.broadcastBuffer(ipcBusCommand, buffer);
    }
}

