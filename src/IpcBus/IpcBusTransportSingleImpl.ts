import { IpcPacketBuffer } from 'socket-serializer';

import * as Client from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';
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
        return this._client && (this._client.listenerCount(channel) > 0);
    }

    onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                if (this.hasChannel(ipcBusCommand.channel)) {
                    const args = ipcPacketBuffer.parseArrayAt(1);
                    this._onCommandMessageReceived(this._client, ipcBusCommand, args);
                }
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                const deferredRequest = this._requestFunctions.get(ipcBusCommand.request.replyChannel);
                if (deferredRequest) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
                    this._requestFunctions.delete(ipcBusCommand.request.replyChannel);
                    const args = ipcPacketBuffer.parseArrayAt(1);
                    deferredRequest.settled(ipcBusCommand, args);
                }
                break;
            }
        }
    }

    // We have to simulate a fake first parameter as this function can be called from an Electron ipc with an event
    // or directly from our code.
    onConnectorBufferReceived(__ignore__: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                if (this.hasChannel(ipcBusCommand.channel)) {
                    this._packetDecoder.setRawContent(rawContent);
                    const args = this._packetDecoder.parseArrayAt(1);
                    this._onCommandMessageReceived(this._client, ipcBusCommand, args);
                }
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                const deferredRequest = this._requestFunctions.get(ipcBusCommand.request.replyChannel);
                if (deferredRequest) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
                    this._requestFunctions.delete(ipcBusCommand.request.replyChannel);
                    this._packetDecoder.setRawContent(rawContent);
                    const args = this._packetDecoder.parseArrayAt(1);
                    deferredRequest.settled(ipcBusCommand, args);
                }
                break;
            }
        }
    }

    ipcConnect(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        return super.ipcConnect(client, options)
        .then((peer) => {
            if (client) {
                this._client = client;
                // const eventNames = client.eventNames();
                // this.ipcPost(client.peer, IpcBusCommand.Kind.Connect, '', eventNames);
            }
            return peer;
        });
    }

    ipcClose(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return super.ipcClose(client, options)
        .then(() => {
            if (client) {
                // this.ipcPost(client.peer, IpcBusCommand.Kind.Close, '');
                this._client = null;
            }
            return this._connector.ipcShutdown(options);
        })
        .then(() => {
            this._connector.removeClient(this);
            this._ipcPostCommand = this.ipcPostCommandFake;
        });
    }

    ipcAddChannels(client: IpcBusTransport.Client, channels: string[]) {
        this.ipcPost(client.peer, IpcBusCommand.Kind.AddChannels, '', channels);
    }

    ipcRemoveChannels(client: IpcBusTransport.Client, channels: string[]) {
        this.ipcPost(client.peer, IpcBusCommand.Kind.RemoveChannels, '', channels);
    }

    ipcPost(peer: Client.IpcBusPeer, kind: IpcBusCommand.Kind, channel: string, args?: any[]): void {
        this._ipcPostCommand({ kind, channel, peer }, args);
    }
}
