import * as uuid from 'uuid';
import { IpcPacketBuffer } from 'socket-serializer';

import * as Client from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';
import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusTransport } from './IpcBusTransport';

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
    private _localInstance: number;

    protected _peer: Client.IpcBusPeer;
    protected _promiseConnected: Promise<void>;

    private _client: Client.IpcBusClient;

    private _requestFunctions: Map<string, DeferredRequest>;
    private _requestNumber: number;
    private _packetDecoder: IpcPacketBuffer;

    constructor(ipcBusContext: Client.IpcBusProcess) {
        this._peer = { id: uuid.v1(), name: '', process: ipcBusContext };
        this._requestFunctions = new Map<string, DeferredRequest>();
        this._requestNumber = 0;
        this._packetDecoder = new IpcPacketBuffer();
    }

    // ----------------------
    // IpcBusClient interface
    // ----------------------
    get peer(): Client.IpcBusPeer {
        return this._peer;
    }

    protected generateName(): string {
        let name = `${this._peer.process.type}-${this._localInstance}`;
        if (this._peer.process.rid) {
            name += `-${this._peer.process.rid}`;
        }
        name += `_${this._peer.process.pid}`;
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

    ipcSendMessage(channel: string, args: any[]): void {
        this.ipcPostCommand({ 
            kind: IpcBusCommand.Kind.SendMessage,
            channel,
            peer: this._peer
        }, args);
    }

    ipcRequestMessage(channel: string, timeoutDelay: number, args: any[]): Promise<Client.IpcBusRequestResponse> {
        if (timeoutDelay == null) {
            timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        const ipcBusCommandRequest: IpcBusCommand.Request = {channel, replyChannel: this.generateReplyChannel() };
        const deferredRequest = new DeferredRequest();
        // Register locally
         this._requestFunctions.set(ipcBusCommandRequest.replyChannel, deferredRequest);
         // Execute request
         this.ipcPost(IpcBusCommand.Kind.SendMessage, channel, ipcBusCommandRequest, args);
        // Clean-up
        if (timeoutDelay >= 0) {
            setTimeout(() => {
                if (this._requestFunctions.delete(ipcBusCommandRequest.replyChannel)) {
                    // Unregister remotely
                    this.ipcPost(IpcBusCommand.Kind.RequestCancel, channel, ipcBusCommandRequest);
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject: timeout`);
                    const response: Client.IpcBusRequestResponse = { event: { channel: channel, sender: this._peer }, err: 'timeout' };
                    deferredRequest.reject(response);
                }
            }, timeoutDelay);
        }
        return deferredRequest.promise;
    }

    ipcConnect(eventEmitter: Client.IpcBusClient | null, options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        if (this._promiseConnected == null) {
            this._promiseConnected = this.ipcHandshake(options)
            .then((handshake) => {
                this._client = eventEmitter;
                this._localInstance = handshake.instance;
                this._peer.name = options.peerName || this.generateName();
                this.ipcPost(IpcBusCommand.Kind.Connect, '');
            });
        }
        return this._promiseConnected;
    }

    ipcClose(eventEmitter: Client.IpcBusClient | null, options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        if (this._promiseConnected) {
            this.ipcPost(IpcBusCommand.Kind.Close, '');
            this._client = null;
            this._promiseConnected = null;
            return this.ipcShutdown(options);
        }
        return Promise.resolve();
    }

    ipcPost(kind: IpcBusCommand.Kind, channel: string, ipcBusCommandRequest?: IpcBusCommand.Request, args?: any[]): void {
        this.ipcPostCommand({ kind, channel, peer: this._peer, request: ipcBusCommandRequest }, args);
    }

    abstract ipcHandshake(options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusTransport.Handshake>;
    abstract ipcShutdown(options: Client.IpcBusClient.CloseOptions): Promise<void>;
    abstract ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;
}
