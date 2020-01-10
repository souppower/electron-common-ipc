import { IpcPacketBuffer } from 'socket-serializer';

import * as Client from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';
import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusTransportClient } from './IpcBusTransport';
import { IpcBusTransportImpl } from './IpcBusTransportImpl';

/** @internal */
export abstract class IpcBusTransportMultiImpl extends IpcBusTransportImpl {
    protected _subscriptions: IpcBusUtils.ChannelConnectionMap<IpcBusTransportClient>;

    constructor(ipcBusContext: Client.IpcBusProcess) {
        super(ipcBusContext);
    }

    protected _onCommandSendMessage(ipcBusCommand: IpcBusCommand, args: any[]) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
        this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
            this._onCommandMessageReceived(connData.conn, ipcBusCommand, args);
        });
    }

    _onCommandPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                if (this._subscriptions.hasChannel(ipcBusCommand.channel)) {
                    const args = ipcPacketBuffer.parseArrayAt(1);
                    this._onCommandSendMessage(ipcBusCommand, args);
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
    _onCommandBufferReceived(__ignore__: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                if (this._subscriptions.hasChannel(ipcBusCommand.channel)) {
                    this._packetDecoder.setRawContent(rawContent);
                    const args = this._packetDecoder.parseArrayAt(1);
                    this._onCommandSendMessage(ipcBusCommand, args);
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

    protected ipcPostMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        this._onCommandSendMessage(ipcBusCommand, args)
        this._ipcPostCommand(ipcBusCommand, args);
    }

    ipcConnect(client: IpcBusTransportClient | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        return super.ipcConnect(client, options)
        .then((peer) => {
            const eventNames = client.eventNames();
            if (this._subscriptions == null) {
                this.ipcPost(this._peer, IpcBusCommand.Kind.Connect, '', eventNames);

                this._subscriptions = new IpcBusUtils.ChannelConnectionMap<IpcBusTransportClient>(`IPCBus:Transport-${IpcBusTransportImpl.generateName(this._peer)}`, true);
                eventNames.forEach(eventName => {
                    this._subscriptions.addRef(eventName as string, client, client.peer);
                });
                this._subscriptions.on('channel-added', (channel: string) => {
                    this.ipcPost(this._peer, IpcBusCommand.Kind.AddChannelListener, channel);
                });
                this._subscriptions.on('channel-removed', (channel: string) => {
                    this.ipcPost(this._peer, IpcBusCommand.Kind.RemoveChannelListener, channel);
                });
            }
            else {
                eventNames.forEach(eventName => {
                    this._subscriptions.addRef(eventName as string, client, client.peer);
                });
            }
            return peer;
        });
    }

    ipcClose(client: IpcBusTransportClient, options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        this.ipcRemoveAllListeners(client);
        if (this._subscriptions.getChannelsCount() === 0) {
            return super.ipcClose(client, options)
            .then(() => {
                this._subscriptions = null;
                this.ipcPost(this._peer, IpcBusCommand.Kind.Close, '');
                return this.ipcShutdown(options)
                .then(() => {
                    this._ipcPostCommand = this.ipcPostCommandFake;
                });
            });
        }
        return Promise.resolve();
    }

    ipcAddChannelListener(client: IpcBusTransportClient, channel: string) {
        this._subscriptions && this._subscriptions.addRef(channel, client, client.peer);
    }

    ipcRemoveChannelListener(client: IpcBusTransportClient, channel: string) {
        this._subscriptions && this._subscriptions.release(channel, client, client.peer);
    }

    ipcRemoveAllListeners(client: IpcBusTransportClient, channel?: string) {
        if (channel) {
            this._subscriptions && this._subscriptions.releaseAll(channel, client, client.peer);
        }
        else {
            this._subscriptions && this._subscriptions.removePeer(client, client.peer);
        }
    }

    abstract ipcHandshake(options: Client.IpcBusClient.ConnectOptions): Promise<void>;
    abstract ipcShutdown(options: Client.IpcBusClient.CloseOptions): Promise<void>;
    abstract ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;
}
