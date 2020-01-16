import { IpcPacketBuffer } from 'socket-serializer';

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
        return this._subscriptions.hasChannel(channel);
    }

    protected _onCommandSendMessage(ipcBusCommand: IpcBusCommand, args: any[]) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
        this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
            this._onCommandMessageReceived(connData.conn, ipcBusCommand, args);
        });
    }

    onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                if (this.hasChannel(ipcBusCommand.channel)) {
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
    onConnectorBufferReceived(__ignore__: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                if (this.hasChannel(ipcBusCommand.channel)) {
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

    ipcConnect(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        return super.ipcConnect(client, options)
        .then((peer) => {
            // const eventNames = client.eventNames();
            if (this._subscriptions == null) {
                // this.ipcPost(this._peer, IpcBusCommand.Kind.Connect, '', eventNames);

                this._subscriptions = new IpcBusUtils.ChannelConnectionMap<IpcBusTransport.Client>(`IPCBus:Transport-${IpcBusTransportImpl.generateName(this._peer)}`, true);
                // eventNames.forEach(eventName => {
                //     this._subscriptions.addRef(eventName as string, client, client.peer);
                // });
                this._subscriptions.on('channels-added', (channels: string[]) => {
                    this.ipcPost(this._peer, IpcBusCommand.Kind.AddChannels, '',channels);
                });
                this._subscriptions.on('channels-removed', (channels: string[]) => {
                    this.ipcPost(this._peer, IpcBusCommand.Kind.RemoveChannels, '', channels);
                });
            }
            // else {
            //     eventNames.forEach(eventName => {
            //         this._subscriptions.addRef(eventName as string, client, client.peer);
            //     });
            // }
            return peer;
        });
    }

    ipcClose(client: IpcBusTransport.Client, options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        if (this._subscriptions.getChannelsCount() === 0) {
            return super.ipcClose(client, options)
            .then(() => {
                this._subscriptions = null;
                // this.ipcPost(this._peer, IpcBusCommand.Kind.Close, '');
                return this._connector.ipcShutdown(options)
                .then(() => {
                    this._connector.removeClient(this);
                    this._ipcPostCommand = this.ipcPostCommandFake;
                });
            });
        }
        return Promise.resolve();
    }

    ipcAddChannels(client: IpcBusTransport.Client, channels: string[]) {
        this._subscriptions && this._subscriptions.addRefs(channels, client, client.peer);
    }

    ipcRemoveChannelListener(client: IpcBusTransport.Client, channels: string[]) {
        this._subscriptions && this._subscriptions.releases(channels, client, client.peer);
    }
}
