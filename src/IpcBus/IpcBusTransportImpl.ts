import * as uuid from 'uuid';
import { IpcPacketBuffer } from 'socket-serializer';

import * as Client from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';
import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusTransport } from './IpcBusTransport';

const replyChannelPrefix = `${Client.IPCBUS_CHANNEL}/request-`;
const v1IdPattern = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

export function extractPeerIdFromReplyChannel(replyChannel: string): string {
    return replyChannel.substr(replyChannelPrefix.length, v1IdPattern.length);
}

/** @internal */
class DeferredRequest {
    public promise: Promise<Client.IpcBusRequestResponse>;

    public resolve: (value: Client.IpcBusRequestResponse) => void;
    public reject: (err: Client.IpcBusRequestResponse) => void;

    private _channel: string;

    constructor(channel: string) {
        this._channel = channel;
        this.promise = new Promise<Client.IpcBusRequestResponse>((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });
    }

    fulFilled(ipcBusCommand: IpcBusCommand, args: any[]) {
        // The channel is not generated one
        const ipcBusEvent: Client.IpcBusEvent = { channel: this._channel, sender: ipcBusCommand.peer };
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
    protected _ipcBusPeer: Client.IpcBusPeer;
    protected _ipcCallback: Function;

    protected _requestFunctions: Map<string, DeferredRequest>;
    protected _requestNumber: number;

    constructor(ipcBusContext: Client.IpcBusProcess) {
        this._ipcBusPeer = { id: uuid.v1(), name: '', process: ipcBusContext };
        this._requestFunctions = new Map<string, DeferredRequest>();
        this._requestNumber = 0;
    }

    // ----------------------
    // IpcBusClient interface
    // ----------------------
    get peer(): Client.IpcBusPeer {
        return this._ipcBusPeer;
    }

    private generateReplyChannel(): string {
        ++this._requestNumber;
        return `${replyChannelPrefix}${this._ipcBusPeer.id}-${this._requestNumber.toString()}`;
    }

    ipcCallback(callback: (channel: string, ipcBusEvent: Client.IpcBusEvent, ...args: any[]) => void): void {
        this._ipcCallback = callback;
    }

    protected _onCommandSendMessage(ipcBusCommand: IpcBusCommand, args: any[]) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
        const ipcBusEvent: Client.IpcBusEvent = { channel: ipcBusCommand.channel, sender: ipcBusCommand.peer };
        this._ipcCallback(ipcBusCommand.channel, ipcBusEvent, ...args);
    }

    protected _onCommandRequestMessage(ipcBusCommand: IpcBusCommand, args: any[]) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
        const ipcBusEvent: Client.IpcBusEvent = { channel: ipcBusCommand.channel, sender: ipcBusCommand.peer };
        ipcBusEvent.request = {
            resolve: (payload: Object | string) => {
                ipcBusCommand.request.resolve = true;
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Resolve request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - payload: ${JSON.stringify(payload)}`);
                this.ipcSend(IpcBusCommand.Kind.RequestResponse, ipcBusCommand.request.replyChannel, ipcBusCommand.request, [payload]);
            },
            reject: (err: string) => {
                ipcBusCommand.request.reject = true;
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Reject request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - err: ${JSON.stringify(err)}`);
                this.ipcSend(IpcBusCommand.Kind.RequestResponse, ipcBusCommand.request.replyChannel, ipcBusCommand.request, [err]);
            }
        };
        this._ipcCallback(ipcBusCommand.channel, ipcBusEvent, ...args);
    }

    protected _onCommandRequestResponse(ipcBusCommand: IpcBusCommand, args: any[]) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
        const deferredRequest = this._requestFunctions.get(ipcBusCommand.request.replyChannel);
        if (deferredRequest) {
            this._requestFunctions.delete(ipcBusCommand.request.replyChannel);
            deferredRequest.fulFilled(ipcBusCommand, args);
        }
    }

    protected _onCommandReceived(ipcBusCommand: IpcBusCommand, args: any[]) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.BridgeSendMessage:
            case IpcBusCommand.Kind.SendMessage: {
                this._onCommandSendMessage(ipcBusCommand, args);
                break;
            }
            case IpcBusCommand.Kind.BridgeRequestMessage:
            case IpcBusCommand.Kind.RequestMessage: {
                this._onCommandRequestMessage(ipcBusCommand, args);
                break;
            }
            case IpcBusCommand.Kind.BridgeRequestResponse:
            case IpcBusCommand.Kind.RequestResponse: {
                this._onCommandRequestResponse(ipcBusCommand, args);
                break;
            }
        }
    }

    protected _onCommandPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        const args = ipcPacketBuffer.parseArrayAt(1);
        this._onCommandReceived(ipcBusCommand, args);
    }

    ipcRequest(channel: string, timeoutDelay: number, args: any[]): Promise<Client.IpcBusRequestResponse> {
        if (timeoutDelay == null) {
            timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        const ipcBusCommandRequest: IpcBusCommand.Request = {channel, replyChannel: this.generateReplyChannel() };

        const deferredRequest = new DeferredRequest(channel);
        // Register locally
         this._requestFunctions.set(ipcBusCommandRequest.replyChannel, deferredRequest);
         // Execute request
         this.ipcSend(IpcBusCommand.Kind.RequestMessage, channel, ipcBusCommandRequest, args);
        // Clean-up
        if (timeoutDelay >= 0) {
            setTimeout(() => {
                if (this._requestFunctions.delete(ipcBusCommandRequest.replyChannel)) {
                    // Unregister remotely
                    this.ipcSend(IpcBusCommand.Kind.RequestCancel, channel, ipcBusCommandRequest);
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject: timeout`);
                    const response: Client.IpcBusRequestResponse = { event: { channel: channel, sender: this._ipcBusPeer }, err: 'timeout' };
                    deferredRequest.reject(response);
                }
            }, timeoutDelay);
        }
        return deferredRequest.promise;
    }

    ipcSend(kind: IpcBusCommand.Kind, channel: string, ipcBusCommandRequest?: IpcBusCommand.Request, args?: any[]): void {
        this.ipcPostCommand({ kind, channel, peer: this.peer, request: ipcBusCommandRequest }, args);
    }

    abstract ipcConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void>;
    abstract ipcClose(options?: Client.IpcBusClient.CloseOptions): Promise<void>;
    abstract ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;
}
