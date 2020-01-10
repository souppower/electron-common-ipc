import { IpcPacketBuffer } from 'socket-serializer';

import * as Client from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';
import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusTransportClient } from './IpcBusTransport';
import { IpcBusTransportImpl } from './IpcBusTransportImpl';

/** @internal */
export abstract class IpcBusTransportSingleImpl extends IpcBusTransportImpl {
    private _client: IpcBusTransportClient;

    constructor(ipcBusContext: Client.IpcBusProcess) {
        super(ipcBusContext);
    }

    protected _onCommandPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                const listeners = this._client && this._client.listeners(ipcBusCommand.channel);
                if (listeners && listeners.length) {
                    const args = ipcPacketBuffer.parseArrayAt(1);
                    this._onCommandMessageReceived(this._client, listeners, ipcBusCommand, args);
                }
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                const deferredRequest = this._requestFunctions.get(ipcBusCommand.request.replyChannel);
                if (deferredRequest) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
                    this._requestFunctions.delete(ipcBusCommand.request.replyChannel);
                    const args = ipcPacketBuffer.parseArrayAt(1);
                    deferredRequest.fulFilled(ipcBusCommand, args);
                }
                break;
            }
        }
    }

    // We have to simulate a fake first parameter as this function can be called from an Electron ipc with an event
    // or directly from our code.
    protected _onCommandBufferReceived(__ignore__: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                const listeners = this._client && this._client.listeners(ipcBusCommand.channel);
                if (listeners && listeners.length) {
                    this._packetDecoder.setRawContent(rawContent);
                    const args = this._packetDecoder.parseArrayAt(1);
                    this._onCommandMessageReceived(this._client, listeners, ipcBusCommand, args);
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
                    deferredRequest.fulFilled(ipcBusCommand, args);
                }
                break;
            }
        }
    }

    ipcConnect(client: IpcBusTransportClient | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        return super.ipcConnect(client, options)
        .then((peer) => {
            this._client = client;
            const eventNames = client.eventNames();
            this.ipcPost(client.peer, IpcBusCommand.Kind.Connect, '', eventNames);
            return peer;
        });
    }

    ipcClose(client: IpcBusTransportClient | null, options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return super.ipcClose(client, options)
        .then(() => {
            this.ipcPost(client.peer, IpcBusCommand.Kind.Close, '');
            this._client = null;
            return this.ipcShutdown(options);
        })
        .then(() => {
            this._ipcPostCommand = this.ipcPostCommandFake;
        });
    }

    ipcAddChannelListener(client: IpcBusTransportClient, channel: string) {
        this.ipcPost(client.peer, IpcBusCommand.Kind.AddChannelListener, channel);
    }

    ipcRemoveChannelListener(client: IpcBusTransportClient, channel: string) {
        this.ipcPost(client.peer, IpcBusCommand.Kind.RemoveChannelListener, channel);
    }

    ipcRemoveAllListeners(client: IpcBusTransportClient, channel?: string) {
        if (channel) {
            this.ipcPost(client.peer, IpcBusCommand.Kind.RemoveChannelAllListeners, channel);
        }
        else {
            this.ipcPost(client.peer, IpcBusCommand.Kind.RemoveListeners, '');
        }
    }
    
    ipcPost(peer: Client.IpcBusPeer, kind: IpcBusCommand.Kind, channel: string, args?: any[]): void {
        this._ipcPostCommand({ kind, channel, peer }, args);
    }

    protected ipcPostCommandFake(ipcBusCommand: IpcBusCommand, args?: any[]): void {
    }
    protected abstract ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;

    abstract ipcHandshake(options: Client.IpcBusClient.ConnectOptions): Promise<void>;
    abstract ipcShutdown(options: Client.IpcBusClient.CloseOptions): Promise<void>;
}
