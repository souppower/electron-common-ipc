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

        // this._bridge.trackAdmin(ipcBusCommand);
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
        throw 'not implemented';
    }

    onMessageReceived(ipcBusCommand: IpcBusCommand, args: any[], local?: boolean): void {
        throw 'not implemented';
    }

    protected postMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        throw 'not implemented';
    }

    // protected postAdmin(ipcBusCommand: IpcBusCommand): void {
        // super.postAdmin(ipcBusCommand);
        // this._bridge.trackAdmin(ipcBusCommand);
    // }

    broadcastBuffer(ipcBusCommand: IpcBusCommand, buffer?: Buffer): void {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                if (ipcBusCommand.request) {
                    this._subscriptions.addRef(ipcBusCommand.request.replyChannel, PeerName, ipcBusCommand.peer);
                }
                if (buffer && this.hasChannel(ipcBusCommand.channel)) {
                    this._connector.postBuffer(buffer);
                }
                break;
            }

            case IpcBusCommand.Kind.RequestResponse: {
                const hasChannel = this._subscriptions.removeChannel(ipcBusCommand.channel);
                if (buffer && hasChannel) {
                    this._connector.postBuffer(buffer);
                }
                break;
            }

            case IpcBusCommand.Kind.RequestClose:
                const hasChannel = this._subscriptions.removeChannel(ipcBusCommand.channel);
                if (buffer && hasChannel) {
                    this._connector.postBuffer(buffer);
                }
                break;
        }
    }

    onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void {
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
    }

    onConnectorBufferReceived(__ignore__: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): void {
        throw 'not implemented';
    }

    onConnectorShutdown(): void {
        this._bridge._onNetClosed();
    }
}

export class IpcBusNetBridge implements IpcBusBridgeClient {
    protected _bridge: IpcBusBridgeImpl;
    protected _transport: IpcBusTransportNetBridge;

    constructor(bridge: IpcBusBridgeImpl) {
        this._bridge = bridge;
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

