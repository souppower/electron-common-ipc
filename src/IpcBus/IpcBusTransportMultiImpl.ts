import * as Client from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';
import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusTransportImpl } from './IpcBusTransportImpl';
import { IpcBusTransport } from './IpcBusTransport';
import { IpcBusConnector } from './IpcBusConnector';

/** @internal */
export class IpcBusTransportMultiImpl extends IpcBusTransportImpl {
    protected _subscriptions: IpcBusUtils.ChannelConnectionMap<IpcBusTransport.Client, string>;

    constructor(connector: IpcBusConnector) {
        super(connector);
    }

    hasChannel(channel: string): boolean {
        return this._subscriptions.hasChannel(channel);
    }

    protected onMessageReceived(local: boolean, ipcBusCommand: IpcBusCommand, args: any[]) {
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
        this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData) => {
            this._onClientMessageReceived(connData.conn, local, ipcBusCommand, args);
        });
    }

    onConnectorShutdown() {
        super.onConnectorShutdown();
        if (this._subscriptions) {
            this._subscriptions.emitter = false;
            this._subscriptions = null;
        }
    }

    connect(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        return super.connect(client, options)
        .then((peer) => {
            if (this._subscriptions == null) {
                this._subscriptions = new IpcBusUtils.ChannelConnectionMap<IpcBusTransport.Client, string>(
                    this._peer.name,
                    (conn) => conn.peer.id,
                    true);
                this._subscriptions.on('channel-added', (channel) => {
                    this.postAdmin({
                        peer: this._peer,
                        kind: IpcBusCommand.Kind.AddChannelListener,
                        channel
                    });
                });
                this._subscriptions.on('channel-removed', (channel) => {
                    this.postAdmin({
                        peer: this._peer,
                        kind: IpcBusCommand.Kind.RemoveChannelListener,
                        channel
                    });
                });
            }
            else {
                // TODO send all existing channels
            }
            return peer;
        });
    }

    close(client: IpcBusTransport.Client, options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        if (this._subscriptions) {
            this.cancelRequest(client);
            if (this._subscriptions.getChannelsCount() === 0) {
                this._subscriptions.emitter = false;
                this._subscriptions = null;
                return super.close(client, options);
            }
            //
            // this.postAdmin({
            //     peer: client.peer,
            //     kind: IpcBusCommand.Kind.RemoveListeners,
            //     channel
            // });
        }
        return Promise.resolve();
    }

    addChannel(client: IpcBusTransport.Client, channel: string, count?: number) {
        if (this._subscriptions == null) {
            return;
        }
        this._subscriptions.addRefCount(channel, client, client.peer, count);
    }

    removeChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean) {
        if (this._subscriptions == null) {
            return;
        }
        if (channel) {
            if (all) {
                this._subscriptions.releaseAll(channel, client, client.peer);
            }
            else {
                this._subscriptions.release(channel, client, client.peer);
            }
        }
        else {
            this._subscriptions.removePeer(client, client.peer);
        }
    }
}
