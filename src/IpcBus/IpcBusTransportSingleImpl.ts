import type * as Client from './IpcBusClient';
import { IpcBusCommand } from './IpcBusCommand';
import type { IpcBusTransport } from './IpcBusTransport';
import { IpcBusTransportImpl } from './IpcBusTransportImpl';
import type { IpcBusConnector } from './IpcBusConnector';

/** @internal */
export  class IpcBusTransportSingleImpl extends IpcBusTransportImpl {
    private _client: IpcBusTransport.Client;

    constructor(connector: IpcBusConnector) {
        super(connector);
    }

    hasChannel(channel: string): boolean {
        return (this._client && (this._client.listenerCount(channel) > 0));
    }

    getChannels(): string[] {
        if (this._client) {
            return this._client.eventNames() as string[];
        }
        return [];
    }

    protected onMessageReceived(local: boolean, ipcBusCommand: IpcBusCommand, args?: any[]): void {
        this._onClientMessageReceived(this._client, local, ipcBusCommand, args);
    }

    onConnectorBeforeShutdown() {
        super.onConnectorBeforeShutdown();
        if (this._client) {
            this.removeChannel(this._client);
            this._client = null;
        }
    }

    connect(client: IpcBusTransport.Client, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        return super.connect(client, options)
        .then((peer) => {
            this._client = client;
            return peer;
        });
    }

    close(client: IpcBusTransport.Client, options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        if (this._client && (this._client === client)) {
            this._client = null;
            return super.close(client, options);
        }
        return Promise.resolve();
    }

    addChannel(client: IpcBusTransport.Client, channel: string, count?: number) {
        let refCount = (count == null) ? 1 : count;
        while (refCount-- > 0) {
            this._postCommand({
                peer: client.peer,
                kind: IpcBusCommand.Kind.AddChannelListener,
                channel
            });
        }
    }

    removeChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean) {
        if (channel) {
            if (all) {
                this._postCommand({
                    peer: client.peer,
                    kind: IpcBusCommand.Kind.RemoveChannelAllListeners,
                    channel
                });
            }
            else {
                this._postCommand({
                    peer: client.peer,
                    kind: IpcBusCommand.Kind.RemoveChannelListener,
                    channel
                });
            }
        }
        else {
            this._postCommand({
                peer: client.peer,
                kind: IpcBusCommand.Kind.RemoveListeners,
                channel: ''
            });
        }
    }
}
