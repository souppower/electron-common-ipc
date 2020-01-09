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
    private static _lastLocalProcessId: number = 0;
    private _localProcessId: number;

    protected _peer: Client.IpcBusPeer;
    protected _waitForConnected: Promise<Client.IpcBusPeer>;
    protected _waitForClosed: Promise<void>;

    private _client: IpcBusTransportClient;

    private _requestFunctions: Map<string, DeferredRequest>;
    private _requestNumber: number;
    private _packetDecoder: IpcPacketBuffer;
    private _ipcPostCommand: Function;

    constructor(ipcBusContext: Client.IpcBusProcess) {
        this._peer = { id: uuid.v1(), name: '', process: ipcBusContext };
        this._requestFunctions = new Map<string, DeferredRequest>();
        this._requestNumber = 0;
        this._localProcessId = IpcBusTransportImpl._lastLocalProcessId++;
        this._packetDecoder = new IpcPacketBuffer();
        this._ipcPostCommand = this.ipcPostCommandFake;
        this._waitForClosed = Promise.resolve();
    }

    protected generateName(): string {
        let name = `${this._peer.process.type}_${this._peer.process.pid}`;
        if (this._peer.process.rid) {
            name += `-${this._peer.process.rid}`;
        }
        name += `-${this._localProcessId}`;
        return name;
    }

    protected generateReplyChannel(): string {
        ++this._requestNumber;
        return `${replyChannelPrefix}${this._peer.id}-${this._requestNumber.toString()}`;
    }

    private _onCommandSendMessage(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        const listeners = this._client && this._client.listeners(ipcBusCommand.channel);
        if (listeners && listeners.length) {
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
            const ipcBusEvent: Client.IpcBusEvent = { channel: ipcBusCommand.channel, sender: ipcBusCommand.peer };
            if (ipcBusCommand.request) {
                const ipcBusCommandResponse = {
                    kind: IpcBusCommand.Kind.RequestResponse,
                    channel: ipcBusCommand.request.replyChannel,
                    peer: this._peer,
                    request: ipcBusCommand.request
                };
                ipcBusEvent.request = {
                    resolve: (payload: Object | string) => {
                        ipcBusCommand.request.resolve = true;
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Resolve request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - payload: ${JSON.stringify(payload)}`);
                        this.ipcPostCommand(ipcBusCommandResponse, [payload]);
                    },
                    reject: (err: string) => {
                        ipcBusCommand.request.reject = true;
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Reject request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - err: ${JSON.stringify(err)}`);
                        this.ipcPostCommand(ipcBusCommandResponse, [err]);
                    }
                };
            }
            const args = ipcPacketBuffer.parseArrayAt(1);
            for (let i = 0; i < listeners.length; ++i) {
                listeners[i].call(this._client, ipcBusEvent, ...args);
            }
        }
    }

    private _onCommandRequestResponse(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
        const deferredRequest = this._requestFunctions.get(ipcBusCommand.request.replyChannel);
        if (deferredRequest) {
            this._requestFunctions.delete(ipcBusCommand.request.replyChannel);
            const args = ipcPacketBuffer.parseArrayAt(1);
            deferredRequest.fulFilled(ipcBusCommand, args);
        }
    }

    protected _onCommandPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                this._onCommandSendMessage(ipcBusCommand, ipcPacketBuffer);
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                this._onCommandRequestResponse(ipcBusCommand, ipcPacketBuffer);
                break;
            }
        }
    }

    // We have to simulate a fake first parameter as this function can be called from an Electron ipc with an event
    // or directly from our code.
    protected _onCommandBufferReceived(__ignore__: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                this._packetDecoder.setRawContent(rawContent);
                this._onCommandSendMessage(ipcBusCommand, this._packetDecoder);
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                this._packetDecoder.setRawContent(rawContent);
                this._onCommandRequestResponse(ipcBusCommand, this._packetDecoder);
                break;
            }
        }
    }

    ipcSendMessage(client: IpcBusTransportClient, channel: string, args: any[]): void {
        this._ipcPostCommand({ 
            kind: IpcBusCommand.Kind.SendMessage,
            channel,
            peer: client.peer
        }, args);
    }

    ipcRequestMessage(client: IpcBusTransportClient, channel: string, timeoutDelay: number, args: any[]): Promise<Client.IpcBusRequestResponse> {
        if (timeoutDelay == null) {
            timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        const ipcBusCommandRequest: IpcBusCommand.Request = {channel, replyChannel: this.generateReplyChannel() };
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
                    // Unregister remotely
                    this._ipcPostCommand({ 
                        kind: IpcBusCommand.Kind.RequestCancel,
                        channel,
                        peer: client.peer
                    });
                }
            }, timeoutDelay);
        }
         // Execute request
         this._ipcPostCommand({ 
            kind: IpcBusCommand.Kind.SendMessage,
            channel,
            peer: client.peer,
            request: ipcBusCommandRequest
        }, args);
        return deferredRequest.promise;
    }

    ipcConnect(client: IpcBusTransportClient | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        if (this._waitForConnected == null) {
            this._waitForConnected = this._waitForClosed
            .then(() => {
                return this.ipcHandshake(options);
            })
            .then(() => {
                this._client = client;
                const peer = { id: uuid.v1(), name: '', process: this._peer.process };
                peer.name = options.peerName || this.generateName();
                const eventNames = client.eventNames();
                this._ipcPostCommand = this.ipcPostCommand;
                this.ipcPost(client.peer, IpcBusCommand.Kind.Connect, '', eventNames);
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
                this.ipcPost(client.peer, IpcBusCommand.Kind.Close, '');
                this._ipcPostCommand = this.ipcPostCommandFake;
                this._client = null;
                return this.ipcShutdown(options);
            });
        }
        return Promise.resolve();
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
