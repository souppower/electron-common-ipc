/// <reference types='electron' />

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusTransportImpl } from '../IpcBusTransportImpl';
import { IpcBusTransport } from '../IpcBusTransport';
import { IpcBusPeer } from '../IpcBusClient';

export class IpcBusBridgeTransportNet extends IpcBusTransportImpl {
    protected _bridge: IpcBusBridgeImpl;
    protected _subscriptions: IpcBusUtils.ChannelConnectionMap<string>;

    constructor(connector: IpcBusConnector, bridge: IpcBusBridgeImpl) {
        super(connector);

        this._bridge = bridge;
        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<string>('IPCBus:NetBridge', false);
    }

    get peer(): IpcBusPeer {
        return this._peer;
    }

    ipcConnect(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        return super.ipcConnect(null, options)
        .then((peer) => {
            this.ipcPostAdmin({
                peer: this._peer,
                kind: IpcBusCommand.Kind.BridgeConnect,
                channel: ''
            });
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
            return peer;
        });
    }

    ipcClose(client: IpcBusTransport.Client | null, options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return super.ipcClose(client, options)
        .then(() => {
            this.ipcPostAdmin({
                peer: this._peer,
                kind: IpcBusCommand.Kind.BridgeClose,
                channel: ''
            });
            return this.ipcCloseFinalize(client, options);
        });
    }

    hasChannel(channel: string): boolean {
        return this._subscriptions.hasChannel(channel);
    }

    getChannels(): string[] {
        return this._subscriptions.getChannels();
    }

    ipcAddChannel(client: IpcBusTransport.Client, channel: string, count?: number): void {
    }

    ipcRemoveChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean): void {
    }

    onConnectorMessageReceived(ipcBusCommand: IpcBusCommand, args: any[]): void {
    }

    protected ipcPostMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
    }

    broadcastBuffer(ipcBusCommand: IpcBusCommand, buffer?: Buffer): void {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                if (ipcBusCommand.request) {
                    this._subscriptions.addRef(ipcBusCommand.request.replyChannel, 'netbroker', ipcBusCommand.peer);
                }
                if (buffer) {
                    this._connector.ipcPostBuffer(buffer);
                }
                break;
            }

            case IpcBusCommand.Kind.RequestResponse: {
                this._subscriptions.removeChannel(ipcBusCommand.request.replyChannel);
                if (buffer) {
                    this._connector.ipcPostBuffer(buffer);
                }
                break;
            }

            case IpcBusCommand.Kind.RequestClose:
                this._subscriptions.removeChannel(ipcBusCommand.request.replyChannel);
                if (buffer) {
                    this._connector.ipcPostBuffer(buffer);
                }
                break;
        }
    }

    onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.AddChannelListener:
                this._subscriptions.addRef(ipcBusCommand.channel, 'netbroker', ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveChannelListener:
                this._subscriptions.release(ipcBusCommand.channel, 'netbroker', ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                this._subscriptions.releaseAll(ipcBusCommand.channel, 'netbroker', ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveListeners:
                this._subscriptions.removePeer('netbroker', ipcBusCommand.peer);
                break;

            default:
                this.broadcastBuffer(ipcBusCommand, null);
                this._bridge._onNetMessageReceived(ipcBusCommand, ipcPacketBuffer);
                break;
        }
    }

    onConnectorBufferReceived(__ignore__: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): void {
    }

    onConnectorClosed(): void {
    }

}

