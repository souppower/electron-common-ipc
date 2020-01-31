import * as Client from './IpcBusClient';
import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusTransport } from './IpcBusTransport';
import { IpcBusTransportImpl } from './IpcBusTransportImpl';
import { IpcBusConnector } from './IpcBusConnector';

/** @internal */
export  class IpcBusTransportSingleImpl extends IpcBusTransportImpl {
    private _client: IpcBusTransport.Client;

    constructor(connector: IpcBusConnector) {
        super(connector);
    }

    hasChannel(channel: string): boolean {
        return (this._client && (this._client.listenerCount(channel) > 0));
    }

    // getChannels(): string[] {
    //     const channels = this._client ? this._client.eventNames() as string[]: [];
    //     if (this._requestFunctions.size) {
    //         return channels.concat(Array.from(this._requestFunctions.keys()));
    //     }
    //     return channels;
    // }

    onMessageReceived(local: boolean, ipcBusCommand: IpcBusCommand, args?: any[]): void {
        this._client && this._onClientMessageReceived(this._client, local, ipcBusCommand, args);
    }

    onConnectorShutdown() {
        super.onConnectorShutdown();
        this._client = null;
    }

    connect(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        if (this._client == null) {
            return super.connect(client, options)
            .then((peer) => {
                if (client) {
                    this._client = client;
                }
                return peer;
            });
        }
        return Promise.resolve(this._client.peer);
    }

    close(client: IpcBusTransport.Client | null, options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        if (this._client && (this._client === client)) {
            this._client = null;
            this.cancelRequest(client);
            return super.close(client, options);
        }
        return Promise.resolve();
    }

    addChannel(client: IpcBusTransport.Client, channel: string, count?: number) {
        let refCount = (count == null) ? 1 : count;
        while (refCount-- > 0) {
            this.postAdmin({
                peer: client.peer,
                kind: IpcBusCommand.Kind.AddChannelListener,
                channel
            });
        }
    }

    removeChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean) {
        if (channel) {
            if (all) {
                this.postAdmin({
                    peer: client.peer,
                    kind: IpcBusCommand.Kind.RemoveChannelAllListeners,
                    channel
                });
            }
            else {
                this.postAdmin({
                    peer: client.peer,
                    kind: IpcBusCommand.Kind.RemoveChannelListener,
                    channel
                });
            }
        }
        else {
            this.postAdmin({
                peer: client.peer,
                kind: IpcBusCommand.Kind.RemoveListeners,
                channel: ''
            });
        }
    }
}
