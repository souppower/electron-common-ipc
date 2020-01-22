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
        return (this._client && (this._client.listenerCount(channel) > 0)) || (this._requestFunctions.get(channel) != null);
    }

    getChannels(): string[] {
        const channels = this._client ? this._client.eventNames() as string[]: [];
        if (this._requestFunctions.size) {
            return channels.concat(Array.from(this._requestFunctions.keys()));
        }
        return channels;
    }

    onConnectorMessageReceived(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        this._client && this._onClientMessageReceived(this._client, ipcBusCommand, args);
    }

    onConnectorClosed() {
        super.onConnectorClosed();
        this._requestFunctions.clear();
        this._client = null;
    }

    ipcConnect(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        if (this._client == null) {
            return super.ipcConnect(client, options)
            .then((peer) => {
                if (client) {
                    this._client = client;
                }
                return peer;
            });
        }
        return Promise.resolve(this._client.peer);
    }

    ipcClose(client: IpcBusTransport.Client | null, options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        if (this._client && (this._client === client)) {
            this._requestFunctions.forEach(request => {
                this.ipcPostMessage({ 
                    kind: IpcBusCommand.Kind.RequestClose,
                    channel: request.request.channel,
                    peer: client.peer,
                    request: request.request
                });
                request.timeout();
            });
            this._requestFunctions.clear();
            this._client = null;
            return this.ipcClose(client, options);
        }
        return Promise.resolve();
    }

    ipcAddChannel(client: IpcBusTransport.Client, channel: string, count?: number) {
        let refCount = (count == null) ? 1 : count;
        while (refCount-- > 0) {
            this.ipcPostAdmin({
                peer: client.peer,
                kind: IpcBusCommand.Kind.AddChannelListener,
                channel
            });
        }
    }

    ipcRemoveChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean) {
        if (channel) {
            if (all) {
                this.ipcPostAdmin({
                    peer: client.peer,
                    kind: IpcBusCommand.Kind.RemoveChannelAllListeners,
                    channel
                });
            }
            else {
                this.ipcPostAdmin({
                    peer: client.peer,
                    kind: IpcBusCommand.Kind.RemoveChannelListener,
                    channel
                });
            }
        }
        else {
            this.ipcPostAdmin({
                peer: client.peer,
                kind: IpcBusCommand.Kind.RemoveListeners,
                channel: ''
            });
        }
    }
}
