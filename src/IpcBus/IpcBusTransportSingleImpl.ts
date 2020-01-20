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

    protected ipcPostCommandMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        if (this.hasChannel(ipcBusCommand.channel)) {
            this._onClientMessageReceived(this._client, ipcBusCommand, args);
        }
        this._ipcPostCommand(ipcBusCommand, args);
    }

    ipcConnect(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        return super.ipcConnect(client, options)
        .then((peer) => {
            if (client) {
                this._client = client;
            }
            return peer;
        });
    }

    ipcClose(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return super.ipcClose(client, options)
        .then(() => {
            if (client) {
                this._requestFunctions.forEach(request => {
                    this._ipcPostCommand({ 
                        kind: IpcBusCommand.Kind.RequestClose,
                        channel: request.request.channel,
                        peer: client.peer,
                        request: request.request
                    });
                });
                this._requestFunctions.clear();
                this._client = null;
            }
            return this._connector.ipcShutdown(options);
        })
        .then(() => {
            this._connector.removeClient(this);
            this._ipcPostCommand = this.ipcPostCommandFake;
        });
    }

    ipcAddChannel(client: IpcBusTransport.Client, channel: string, count?: number) {
        let refCount = (count == null) ? 1 : count;
        while (refCount-- > 0) {
            this.ipcPost(client.peer, IpcBusCommand.Kind.AddChannelListener, channel);
        }
    }

    ipcRemoveChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean) {
        if (channel) {
            if (all) {
                this.ipcPost(client.peer, IpcBusCommand.Kind.RemoveChannelAllListeners, channel);
            }
            else {
                this.ipcPost(client.peer, IpcBusCommand.Kind.RemoveListeners, channel);
            }
        }
        else {
            this.ipcPost(client.peer, IpcBusCommand.Kind.RemoveChannelListener, channel);
        }
    }

    ipcPost(peer: Client.IpcBusPeer, kind: IpcBusCommand.Kind, channel: string, args?: any[]): void {
        this._ipcPostCommand({ kind, channel, peer }, args);
    }
}
