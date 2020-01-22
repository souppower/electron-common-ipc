import * as uuid from 'uuid';
import { IpcPacketBuffer } from 'socket-serializer';

import * as Client from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';
import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusTransport } from './IpcBusTransport';
import { IpcBusConnector } from './IpcBusConnector';

const replyChannelPrefix = `${Client.IPCBUS_CHANNEL}/request-`;

/** @internal */
class DeferredRequest {
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
        });
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
    private static s_requestNumber: number;

    protected _peer: Client.IpcBusPeer;
    protected _waitForConnected: Promise<Client.IpcBusPeer>;
    protected _waitForClosed: Promise<void>;

    protected _requestFunctions: Map<string, DeferredRequest>;
    protected _packetDecoder: IpcPacketBuffer;
    protected _ipcPostCommand: Function;

    protected _connector: IpcBusConnector;

    constructor(connector: IpcBusConnector) {
        this._connector = connector;

        this._peer = { id: uuid.v1(), name: '', process: connector.process };
        this._requestFunctions = new Map<string, DeferredRequest>();
        this._packetDecoder = new IpcPacketBuffer();
        this._ipcPostCommand = this.ipcPostCommandFake;
        this._waitForClosed = Promise.resolve();
    }
    
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
    protected _onClientMessageReceived(client: IpcBusTransport.Client, ipcBusCommand: IpcBusCommand, args: any[]): void {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
        const listeners = client.listeners(ipcBusCommand.channel);
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
                    deferredRequest.settled(ipcBusCommand, args);
                }
                else {
                    this.ipcPostMessage(ipcBusCommandResponse, args);
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
        for (let i = 0; i < listeners.length; ++i) {
            listeners[i].call(client, ipcBusEvent, ...args);
        }
    }

    onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                if (this.hasChannel(ipcBusCommand.channel)) {
                    const args = ipcPacketBuffer.parseArrayAt(1);
                    this.onConnectorMessageReceived(ipcBusCommand, args);
                }
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                const deferredRequest = this._requestFunctions.get(ipcBusCommand.channel);
                if (deferredRequest) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
                    this._requestFunctions.delete(ipcBusCommand.request.replyChannel);
                    const args = ipcPacketBuffer.parseArrayAt(1);
                    deferredRequest.settled(ipcBusCommand, args);
                }
                break;
            }
            case IpcBusCommand.Kind.RequestClose: {
                this._requestFunctions.delete(ipcBusCommand.request.replyChannel);
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
                    this.onConnectorMessageReceived(ipcBusCommand, args);
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
            case IpcBusCommand.Kind.RequestClose: {
                this._requestFunctions.delete(ipcBusCommand.request.replyChannel);
                break;
            }
        }
    }

    // IpcConnectorClient
    onConnectorClosed() {
        this._waitForConnected = null;
    }

    sendMessage(client: IpcBusTransport.Client, channel: string, args: any[]): void {
        const ipcMessage: IpcBusCommand = { 
            kind: IpcBusCommand.Kind.SendMessage,
            channel,
            peer: client.peer
        }
        // Broadcast locally
        if (this.hasChannel(channel)) {
            this.onConnectorMessageReceived(ipcMessage, args);
        }
        this.ipcPostMessage(ipcMessage, args);
    }

    requestMessage(client: IpcBusTransport.Client, channel: string, timeoutDelay: number, args: any[]): Promise<Client.IpcBusRequestResponse> {
        if (timeoutDelay == null) {
            timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        const ipcBusCommandRequest: IpcBusCommand.Request = {channel, replyChannel: IpcBusTransportImpl.generateReplyChannel(client.peer) };
        const deferredRequest = new DeferredRequest(client, ipcBusCommandRequest);
        // Register locally
         this._requestFunctions.set(ipcBusCommandRequest.replyChannel, deferredRequest);
        // Clean-up
        if (timeoutDelay >= 0) {
            setTimeout(() => {
                if (this._requestFunctions.delete(ipcBusCommandRequest.replyChannel)) {
                    deferredRequest.timeout();
                }
                // Unregister remotely
                this.ipcPostMessage({ 
                    kind: IpcBusCommand.Kind.RequestClose,
                    channel,
                    peer: client.peer,
                    request: ipcBusCommandRequest
                });
            }, timeoutDelay);
        }
        const ipcMessage: IpcBusCommand = { 
            kind: IpcBusCommand.Kind.SendMessage,
            channel,
            peer: client.peer,
            request: ipcBusCommandRequest
        }
        // Broadcast locally
        if (this.hasChannel(channel)) {
            this.onConnectorMessageReceived(ipcMessage, args);
        }
        // If not resolved by local clients
        if (deferredRequest.isSettled() === false) {
            this.ipcPostMessage(ipcMessage, args);
        }
        return deferredRequest.promise;
    }

    connect(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        if (this._waitForConnected == null) {
            this._waitForConnected = this._waitForClosed
            .then(() => {
                this._connector.addClient(this);
                return this._connector.ipcHandshake(options);
            })
            .then((handshake) => {
                const peer = { id: uuid.v1(), name: '', process: handshake.process };
                peer.name = options.peerName || IpcBusTransportImpl.generateName(peer);
                this._ipcPostCommand = this.ipcPostCommand;
                return peer;
            })
            .catch((err) => {
                this._connector.removeClient(this);
                this._waitForConnected = null;
                throw err;
            });
        }
        return this._waitForConnected;
    }

    close(client: IpcBusTransport.Client | null, options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        if (this._waitForConnected) {
            const waitForConnected = this._waitForConnected;
            this._waitForConnected = null;
            this._waitForClosed = waitForConnected
            .then(() => {
                return this._connector.ipcShutdown(options);
            })
            .then(() => {
                this._connector.removeClient(this);
                this._ipcPostCommand = this.ipcPostCommandFake;
            });
        }
        return this._waitForClosed;
    }

    protected ipcPostAdmin(ipcBusCommand: IpcBusCommand): void {
        this._ipcPostCommand(ipcBusCommand);
    }

    protected ipcPostMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        this._ipcPostCommand(ipcBusCommand, args);
    }

    protected ipcPostCommandFake(ipcBusCommand: IpcBusCommand, args?: any[]): void {
    }

    protected ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        this._connector.ipcPostCommand(ipcBusCommand, args);
    }

    abstract hasChannel(channel: string): boolean;
    abstract getChannels(): string[];
    abstract onConnectorMessageReceived(ipcBusCommand: IpcBusCommand, args: any[]): void;

    abstract addChannel(client: IpcBusTransport.Client, channel: string, count?: number): void;
    abstract removeChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean): void;
}
