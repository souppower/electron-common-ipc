import * as uuid from 'uuid';
import { IpcPacketBuffer } from 'socket-serializer';

import * as Client from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';
import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusTransport } from './IpcBusTransport';
import { IpcBusConnector } from './IpcBusConnector';

const replyChannelPrefix = `${Client.IPCBUS_CHANNEL}/request-`;

/** @internal */
class DeferredRequestPromise {
    public promise: Promise<Client.IpcBusRequestResponse>;

    public resolve: (value: Client.IpcBusRequestResponse) => void;
    public reject: (err: Client.IpcBusRequestResponse) => void;

    client: IpcBusTransport.Client;
    request: IpcBusCommand.Request;

    private _settled: boolean;

    constructor(client: IpcBusTransport.Client, request: IpcBusCommand.Request) {
        this.client = client;
        this.request = request;
        this.promise = new Promise<Client.IpcBusRequestResponse>((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        })
        // Prevent unhandled rejected promise
        this.promise.catch(() => { });
        this._settled = false;
    }

    isSettled(): boolean {
        return this._settled;
    }

    settled(ipcBusCommand: IpcBusCommand, args: any[]) {
        if (this._settled === false) {
            const ipcBusEvent: Client.IpcBusEvent = { channel: ipcBusCommand.request.channel, sender: ipcBusCommand.peer };
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Peer #${ipcBusEvent.sender.name} replied to request on ${ipcBusCommand.request.replyChannel}`);
            try {
                if (ipcBusCommand.request.resolve) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] resolve`);
                    const response: Client.IpcBusRequestResponse = { event: ipcBusEvent, payload: args[0] };
                    this.resolve(response);
                }
                else if (ipcBusCommand.request.reject) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject: ${args[0]}`);
                    const response: Client.IpcBusRequestResponse = { event: ipcBusEvent, err: args[0] };
                    this.reject(response);
                }
                else {
                    throw 'unknown format';
                }
            }
            catch (err) {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject: ${err}`);
                const response: Client.IpcBusRequestResponse = { event: ipcBusEvent, err };
                this.reject(response);
            }
            this._settled = true;
        }
    }

    timeout(): void {
        const response: Client.IpcBusRequestResponse = {
            event: {
                channel: this.request.channel,
                sender: this.client.peer
            },
            err: 'timeout'
        };
        this.reject(response);
    }
}

/** @internal */
export abstract class IpcBusTransportImpl implements IpcBusTransport, IpcBusConnector.Client {
    private static s_requestNumber: number = 0;

    protected _connector: IpcBusConnector;

    protected _peer: Client.IpcBusPeer;
    protected _logActivate: boolean;

    protected _connectCloseState: IpcBusUtils.ConnectCloseState<Client.IpcBusPeer>;

    protected _requestFunctions: Map<string, DeferredRequestPromise>;
    protected _packetDecoder: IpcPacketBuffer;
    protected _postCommandBind: Function;

    constructor(connector: IpcBusConnector) {
        this._connector = connector;

        this._peer = { id: uuid.v1(), name: '', process: connector.process };
        this._requestFunctions = new Map<string, DeferredRequestPromise>();
        this._packetDecoder = new IpcPacketBuffer();
        this._postCommandBind = () => { };
        this._connectCloseState = new IpcBusUtils.ConnectCloseState<Client.IpcBusPeer>();
    }

    get peer(): Client.IpcBusPeer {
        return this._peer;
    }

    // hasRequestChannel(channel: string): boolean {
    //     return this._requestFunctions.get(channel) != null;
    // }

    protected static generateReplyChannel(peer: Client.IpcBusPeer): string {
        ++IpcBusTransportImpl.s_requestNumber;
        return `${replyChannelPrefix}${peer.id}-${IpcBusTransportImpl.s_requestNumber.toString()}`;
    }

    protected static generateName(peer: Client.IpcBusPeer): string {
        let name = `${peer.process.type}`;
        if (peer.process.wcid) {
            name += `-${peer.process.wcid}`;
        }
        if (peer.process.rid && (peer.process.rid !== peer.process.wcid)) {
            name += `-r${peer.process.rid}`;
        }
        if (peer.process.pid) {
            name += `_p${peer.process.pid}`;
        }
        return name;
    }

    // We assume prior to call this function client is not empty and have listeners for this channel !!
    protected _onClientMessageReceived(client: IpcBusTransport.Client, local: boolean, ipcBusCommand: IpcBusCommand, args?: any[]): void {
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
        const listeners = client.listeners(ipcBusCommand.channel);
        const ipcBusEvent: Client.IpcBusEvent = { channel: ipcBusCommand.channel, sender: ipcBusCommand.peer };
        if (ipcBusCommand.request) {
            const settled = (resolve: boolean, argsResponse: any[]) => {
                const ipcBusCommandResponse: IpcBusCommand = {
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
                if (local) {
                    const deferredRequest = this._requestFunctions.get(ipcBusCommand.request.replyChannel);
                    if (deferredRequest) {
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
                        this._requestFunctions.delete(ipcBusCommand.request.replyChannel);
                        // Send the local response to log
                        if (this._logActivate) {
                            this._connector.logLocalResponse(ipcBusCommand, ipcBusCommandResponse, argsResponse);
                        }
                        deferredRequest.settled(ipcBusCommandResponse, argsResponse);
                    }
                }
                else {
                    if (this._logActivate) {
                        this._connector.logMessageCreation(ipcBusCommand, ipcBusCommandResponse);
                    } 
                    this.postMessage(ipcBusCommandResponse, argsResponse);
                }
            }
            ipcBusEvent.request = {
                resolve: (payload: Object | string) => {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Resolve request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - payload: ${JSON.stringify(payload)}`);
                    settled(true, [payload]);
                },
                reject: (err: string) => {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Reject request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - err: ${JSON.stringify(err)}`);
                    settled(false, [err]);
                }
            };
        }
        if (this._logActivate) {
            this._connector.logMessageReceived(client.peer, local, ipcBusCommand, args);
        }
        for (let i = 0, l = listeners.length; i < l; ++i) {
            listeners[i].call(client, ipcBusEvent, ...args);
        }
    }

    onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                if (this.hasChannel(ipcBusCommand.channel)) {
                    const args = ipcPacketBuffer.parseArrayAt(1);
                    this.onMessageReceived(false, ipcBusCommand, args);
                }
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                const deferredRequest = this._requestFunctions.get(ipcBusCommand.channel);
                if (deferredRequest) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
                    this._requestFunctions.delete(ipcBusCommand.request.replyChannel);
                    const args = ipcPacketBuffer.parseArrayAt(1);
                    if (this._logActivate) {
                        this._connector.logMessageReceived(deferredRequest.client.peer, false, ipcBusCommand, args);
                    }
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
                    this.onMessageReceived(false, ipcBusCommand, args);
                }
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                const deferredRequest = this._requestFunctions.get(ipcBusCommand.channel);
                if (deferredRequest) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
                    this._requestFunctions.delete(ipcBusCommand.channel);
                    this._packetDecoder.setRawContent(rawContent);
                    const args = this._packetDecoder.parseArrayAt(1);
                    if (this._logActivate) {
                        this._connector.logMessageReceived(deferredRequest.client.peer, false, ipcBusCommand, args);
                    }
                    deferredRequest.settled(ipcBusCommand, args);
                }
                break;
            }
        }
    }

    // IpcConnectorClient
    onConnectorShutdown() {
        this._connectCloseState.shutdown();
        this._requestFunctions.clear();
    }

    sendMessage(client: IpcBusTransport.Client, channel: string, args: any[]): void {
        const ipcMessage: IpcBusCommand = {
            kind: IpcBusCommand.Kind.SendMessage,
            channel,
            peer: client.peer
        }
        // Broadcast locally
        if (this._logActivate) {
            this._connector.logMessageCreation(null, ipcMessage);
        }
        if (this.hasChannel(channel)) {
            this.onMessageReceived(true, ipcMessage, args);
        }
        this.postMessage(ipcMessage, args);
    }

    protected cancelRequest(client: IpcBusTransport.Client): void {
        this._requestFunctions.forEach((request, key) => {
            if (client === request.client) {
                request.timeout();
                this._requestFunctions.delete(key);
                const ipcMessageClose: IpcBusCommand = {
                    kind: IpcBusCommand.Kind.RequestClose,
                    channel: request.request.channel,
                    peer: request.client.peer,
                    request: request.request
                };
                if (this._logActivate) {
                    this._connector.logMessageCreation(null, ipcMessageClose);
                }
                this.postMessage(ipcMessageClose);
            }
        });
    }

    requestMessage(client: IpcBusTransport.Client, channel: string, timeoutDelay: number, args: any[]): Promise<Client.IpcBusRequestResponse> {
        if (timeoutDelay == null) {
            timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        const ipcBusCommandRequest: IpcBusCommand.Request = { channel, replyChannel: IpcBusTransportImpl.generateReplyChannel(client.peer) };
        const deferredRequest = new DeferredRequestPromise(client, ipcBusCommandRequest);
        // Register locally
        this._requestFunctions.set(ipcBusCommandRequest.replyChannel, deferredRequest);
        const ipcMessage: IpcBusCommand = {
            kind: IpcBusCommand.Kind.SendMessage,
            channel,
            peer: client.peer,
            request: ipcBusCommandRequest
        }
        if (this._logActivate) {
            this._connector.logMessageCreation(null, ipcMessage);
        }
        // Broadcast locally
        if (this.hasChannel(channel)) {
            this.onMessageReceived(true, ipcMessage, args);
        }
        // If not resolved by local clients
        if (deferredRequest.isSettled() === false) {
            // Clean-up
            if (timeoutDelay >= 0) {
                setTimeout(() => {
                    if (this._requestFunctions.delete(ipcBusCommandRequest.replyChannel)) {
                        deferredRequest.timeout();
                        const ipcMessageClose: IpcBusCommand = {
                            kind: IpcBusCommand.Kind.RequestClose,
                            channel,
                            peer: client.peer,
                            request: ipcBusCommandRequest
                        };
                        if (this._logActivate) {
                            this._connector.logMessageCreation(null, ipcMessageClose);
                        }
                        this.postMessage(ipcMessageClose);
                    }
                }, timeoutDelay);
            }
            this.postMessage(ipcMessage, args);
        }
        return deferredRequest.promise;
    }

    connect(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        return this._connectCloseState.connect(() => {
            return this._connector.handshake(this, options)
                .then((handshake) => {
                    const peer = { id: uuid.v1(), name: '', process: handshake.process };
                    peer.name = options.peerName || IpcBusTransportImpl.generateName(peer);
                    this._logActivate = handshake.logLevel > 0;
                    this._postCommandBind = this._connector.postCommand.bind(this._connector);
                    return peer;
                });
        });
    }

    close(client: IpcBusTransport.Client | null, options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return this._connectCloseState.close(() => {
            return this._connector.shutdown(this, options)
                .then(() => {
                    this._postCommandBind = () => { };
                });
        });
    }

    protected postAdmin(ipcBusCommand: IpcBusCommand): void {
        this._postCommandBind(ipcBusCommand);
    }

    protected postMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        this._postCommandBind(ipcBusCommand, args);
    }

    abstract hasChannel(channel: string): boolean;
    // abstract getChannels(): string[];
    abstract onMessageReceived(local: boolean, ipcBusCommand: IpcBusCommand, args: any[]): void;

    abstract addChannel(client: IpcBusTransport.Client, channel: string, count?: number): void;
    abstract removeChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean): void;
}
