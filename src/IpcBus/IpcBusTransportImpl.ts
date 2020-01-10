import * as uuid from 'uuid';
import { IpcPacketBuffer } from 'socket-serializer';

import * as Client from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';
import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusTransport, IpcBusTransportClient } from './IpcBusTransport';

const replyChannelPrefix = `${Client.IPCBUS_CHANNEL}/request-`;

/** @internal */
class DeferredRequest {
    public promise: Promise<Client.IpcBusRequestResponse>;

    public resolve: (value: Client.IpcBusRequestResponse) => void;
    public reject: (err: Client.IpcBusRequestResponse) => void;

    constructor() {
        this.promise = new Promise<Client.IpcBusRequestResponse>((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });
    }

    fulFilled(ipcBusCommand: IpcBusCommand, args: any[]) {
        const ipcBusEvent: Client.IpcBusEvent = { channel: ipcBusCommand.request.channel, sender: ipcBusCommand.peer };
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Peer #${ipcBusEvent.sender.name} replied to request on ${ipcBusCommand.request.replyChannel}`);
        if (ipcBusCommand.request.resolve) {
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] resolve`);
            const response: Client.IpcBusRequestResponse = { event: ipcBusEvent, payload: args[0] };
            this.resolve(response);
        }
        else if (ipcBusCommand.request.reject) {
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject`);
            const response: Client.IpcBusRequestResponse = { event: ipcBusEvent, err: args[0] };
            this.reject(response);
        }
        else {
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject: unknown format`);
            const response: Client.IpcBusRequestResponse = { event: ipcBusEvent, err: 'unknown format' };
            this.reject(response);
        }
    };
}

/** @internal */
export abstract class IpcBusTransportImpl implements IpcBusTransport {
    private static s_clientId: number = 0;
    private static s_requestNumber: number;

    protected _peer: Client.IpcBusPeer;
    protected _waitForConnected: Promise<Client.IpcBusPeer>;
    protected _waitForClosed: Promise<void>;

    protected _requestFunctions: Map<string, DeferredRequest>;
    protected _packetDecoder: IpcPacketBuffer;
    protected _ipcPostCommand: Function;

    constructor(ipcBusContext: Client.IpcBusProcess) {
        this._peer = { id: uuid.v1(), name: '', process: ipcBusContext };
        this._requestFunctions = new Map<string, DeferredRequest>();
        this._packetDecoder = new IpcPacketBuffer();
        this._ipcPostCommand = this.ipcPostCommandFake;
        this._waitForClosed = Promise.resolve();
    }

    protected static generateName(peer: Client.IpcBusPeer): string {
        let name = `${peer.process.type}_${peer.process.pid}`;
        if (peer.process.rid) {
            name += `-${peer.process.rid}`;
        }
        ++IpcBusTransportImpl.s_clientId;
        name += `-${IpcBusTransportImpl.s_clientId}`;
        return name;
    }

    protected static generateReplyChannel(peer: Client.IpcBusPeer): string {
        ++IpcBusTransportImpl.s_requestNumber;
        return `${replyChannelPrefix}${peer.id}-${IpcBusTransportImpl.s_requestNumber.toString()}`;
    }

    protected _onCommandMessageReceived(client: IpcBusTransportClient, listeners: Function[], ipcBusCommand: IpcBusCommand, args: any[]): void {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
        const ipcBusEvent: Client.IpcBusEvent = { channel: ipcBusCommand.channel, sender: ipcBusCommand.peer };
        if (ipcBusCommand.request) {
            const settled = (resolve: boolean, args: any[]) => {
                const ipcBusCommandResponse = {
                    kind: IpcBusCommand.Kind.RequestResponse,
                    channel: ipcBusCommand.request.replyChannel,
                    peer: client.peer,
                    request: ipcBusCommand.request
                };
                if (resolve) {
                    ipcBusCommand.request.resolve = true;
                }
                else {
                    ipcBusCommand.request.reject = true;
                }
                // Is it a local request ?
                const deferredRequest = this._requestFunctions.get(ipcBusCommand.request.replyChannel);
                if (deferredRequest) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
                    this._requestFunctions.delete(ipcBusCommand.request.replyChannel);
                    deferredRequest.fulFilled(ipcBusCommand, args);
                }
                else {
                    this.ipcPostCommand(ipcBusCommandResponse, args);
                }
            }
            ipcBusEvent.request = {
                resolve: (payload: Object | string) => {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Resolve request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - payload: ${JSON.stringify(payload)}`);
                    settled(true, [payload]);
                },
                reject: (err: string) => {
                    ipcBusCommand.request.reject = true;
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Reject request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - err: ${JSON.stringify(err)}`);
                    settled(false, [err]);
                }
            };
        }
        for (let i = 0; i < listeners.length; ++i) {
            listeners[i].call(client, ipcBusEvent, ...args);
        }
    }

    ipcSendMessage(client: IpcBusTransportClient, channel: string, args: any[]): void {
        this.ipcPostMessage({ 
            kind: IpcBusCommand.Kind.SendMessage,
            channel,
            peer: client.peer
        }, args);
    }

    ipcRequestMessage(client: IpcBusTransportClient, channel: string, timeoutDelay: number, args: any[]): Promise<Client.IpcBusRequestResponse> {
        if (timeoutDelay == null) {
            timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        const ipcBusCommandRequest: IpcBusCommand.Request = {channel, replyChannel: IpcBusTransportImpl.generateReplyChannel(client.peer) };
        const deferredRequest = new DeferredRequest();
        // Register locally
         this._requestFunctions.set(ipcBusCommandRequest.replyChannel, deferredRequest);
        // Clean-up
        if (timeoutDelay >= 0) {
            setTimeout(() => {
                if (this._requestFunctions.delete(ipcBusCommandRequest.replyChannel)) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject: timeout`);
                    const response: Client.IpcBusRequestResponse = { event: { channel: channel, sender: this._peer }, err: 'timeout' };
                    deferredRequest.reject(response);
                }
                // Unregister remotely
                this._ipcPostCommand({ 
                    kind: IpcBusCommand.Kind.RequestClose,
                    channel,
                    peer: client.peer
                });
            }, timeoutDelay);
        }
         // Execute request
         this.ipcPostMessage({ 
            kind: IpcBusCommand.Kind.SendMessage,
            channel,
            peer: client.peer,
            request: ipcBusCommandRequest
        }, args);
        return deferredRequest.promise;
    }

    protected ipcPostMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        this._ipcPostCommand(ipcBusCommand, args);
    }

    ipcConnect(client: IpcBusTransportClient | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        if (this._waitForConnected == null) {
            this._waitForConnected = this._waitForClosed
            .then(() => {
                return this.ipcHandshake(options);
            })
            .then(() => {
                const peer = { id: uuid.v1(), name: '', process: this._peer.process };
                peer.name = options.peerName || IpcBusTransportImpl.generateName(peer);
                this._ipcPostCommand = this.ipcPostCommand;
                return peer;
            });
        }
        return this._waitForConnected;
    }

    ipcClose(client: IpcBusTransportClient | null, options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        if (this._waitForConnected) {
            const waitForConnected = this._waitForConnected;
            this._waitForConnected = null;
            this._waitForClosed = waitForConnected
            .then(() => {
            })
        }
        return this._waitForClosed;
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

    abstract ipcHandshake(options: Client.IpcBusClient.ConnectOptions): Promise<void>;
    abstract ipcShutdown(options: Client.IpcBusClient.CloseOptions): Promise<void>;

    protected abstract ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;
    protected abstract _onCommandPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void;
    protected abstract _onCommandBufferReceived(__ignore__: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): void;
}
