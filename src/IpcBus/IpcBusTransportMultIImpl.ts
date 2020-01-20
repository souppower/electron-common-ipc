import * as Client from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';
import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusTransportImpl } from './IpcBusTransportImpl';
import { IpcBusTransport } from './IpcBusTransport';
import { IpcBusConnector } from './IpcBusConnector';

/** @internal */
export class IpcBusTransportMultiImpl extends IpcBusTransportImpl {
    protected _subscriptions: IpcBusUtils.ChannelConnectionMap<IpcBusTransport.Client>;

    constructor(connector: IpcBusConnector) {
        super(connector);
    }

    hasChannel(channel: string): boolean {
        return this._subscriptions.hasChannel(channel) || (this._requestFunctions.get(channel) != null);
    }

    getChannels(): string[] {
        const channels = this._subscriptions.getChannels();
        if (this._requestFunctions.size) {
            return channels.concat(Array.from(this._requestFunctions.keys()));
        }
        return channels;
    }

    onConnectorMessageReceived(ipcBusCommand: IpcBusCommand, args: any[]) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
        this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
            this._onClientMessageReceived(connData.conn, ipcBusCommand, args);
        });
    }

    ipcConnect(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        return super.ipcConnect(client, options)
        .then((peer) => {
            if (this._subscriptions == null) {
                this._subscriptions = new IpcBusUtils.ChannelConnectionMap<IpcBusTransport.Client>(`IPCBus:Transport-${IpcBusTransportImpl.generateName(this._peer)}`, true);
                this._subscriptions.on('channel-added', (channel: string) => {
                    this.ipcPost(this._peer, IpcBusCommand.Kind.AddChannelListener, channel);
                });
                this._subscriptions.on('channel-removed', (channel: string) => {
                    this.ipcPost(this._peer, IpcBusCommand.Kind.RemoveChannelListener, channel);
                });
            }
            return peer;
        });
    }

    ipcClose(client: IpcBusTransport.Client, options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        if (this._subscriptions.getChannelsCount() === 0) {
            return super.ipcClose(client, options)
            .then(() => {
                this._subscriptions.emitter = false;
                this._subscriptions.clear();
                this._subscriptions = null;
                this._requestFunctions.forEach(request => {
                    if (request.client === client) {
                        this.ipcPostCommandMessage({ 
                            kind: IpcBusCommand.Kind.RequestClose,
                            channel: request.request.channel,
                            peer: client.peer,
                            request: request.request
                        });
                        this._requestFunctions.delete(request.request.replyChannel);
                    }
                });
                return this.ipcCloseFinalize(client, options);
            });
        }
        return Promise.resolve();
    }

    ipcAddChannel(client: IpcBusTransport.Client, channel: string, count?: number) {
        if (this._subscriptions == null) {
            return;
        }
        this._subscriptions.addRefCount(channel, client, client.peer, count);
    }

    ipcRemoveChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean) {
        if (this._subscriptions == null) {
            return;
        }
        // this._subscriptions.emitter = false;
        if (channel) {
            if (all) {
                this._subscriptions.releaseAll(channel, client, client.peer);
                // this.ipcPost(client.peer, IpcBusCommand.Kind.RemoveChannelAllListeners, channel);
            }
            else {
                this._subscriptions.release(channel, client, client.peer);
                // this.ipcPost(client.peer, IpcBusCommand.Kind.RemoveListeners, channel);
            }
        }
        else {
            this._subscriptions.removePeer(client, client.peer);
            // this.ipcPost(client.peer, IpcBusCommand.Kind.RemoveChannelListener, channel);
        }
        // this._subscriptions.emitter = true;
    }
}
