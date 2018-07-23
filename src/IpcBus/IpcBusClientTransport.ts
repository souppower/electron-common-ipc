import * as uuid from 'uuid';
import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';
import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusClientImpl } from './IpcBusClientImpl';

const replyChannelPrefix = `${IpcBusInterfaces.IPCBUS_CHANNEL}/request-`;
const v1IdPattern = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

/** @internal */
export abstract class IpcBusClientTransport extends IpcBusClientImpl {
    protected _ipcBusPeer: IpcBusInterfaces.IpcBusPeer;
    protected readonly _netOptions: IpcBusInterfaces.IpcNetOptions;

    protected _requestFunctions: Map<string, Function>;
    protected _requestNumber: number;

    constructor(ipcBusProcess: IpcBusInterfaces.IpcBusProcess, options: IpcBusInterfaces.IpcBusClient.CreateOptions) {
        super(options);

        this._ipcBusPeer = { id: uuid.v1(), name: '', process: ipcBusProcess };
        this._netOptions = options;
        this._requestFunctions = new Map<string, Function>();
        this._requestNumber = 0;
    }

    // ----------------------
    // IpcBusClient interface
    // ----------------------
    get peer(): IpcBusInterfaces.IpcBusPeer {
        return this._ipcBusPeer;
    }

    private generateReplyChannel(): string {
        ++this._requestNumber;
        return `${replyChannelPrefix}${this._ipcBusPeer.id}-${this._requestNumber.toString()}`;
    }

    protected extractPeerIdFromReplyChannel(replyChannel: string): string {
        return replyChannel.substr(replyChannelPrefix.length, v1IdPattern.length);
    }

    protected _onEventReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
                const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = { channel: ipcBusCommand.channel, sender: ipcBusCommand.peer };
                let args = ipcPacketBuffer.parseArrayAt(1);
                this.emit(ipcBusCommand.emit || ipcBusCommand.channel, ipcBusEvent, ...args);
                break;
            }
            case IpcBusCommand.Kind.RequestMessage: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Emit request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
                let ipcBusEvent: IpcBusInterfaces.IpcBusEvent = { channel: ipcBusCommand.channel, sender: ipcBusCommand.peer };
                ipcBusEvent.request = {
                    resolve: (payload: Object | string) => {
                        ipcBusCommand.request.resolve = true;
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Resolve request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - payload: ${JSON.stringify(payload)}`);
                        this.ipcSend(IpcBusCommand.Kind.RequestResponse, ipcBusCommand.request.replyChannel, ipcBusCommand.request, [payload]);
                    },
                    reject: (err: string) => {
                        ipcBusCommand.request.reject = true;
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Reject request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - err: ${JSON.stringify(err)}`);
                        this.ipcSend(IpcBusCommand.Kind.RequestResponse, ipcBusCommand.request.replyChannel, ipcBusCommand.request, [err]);
                    }
                };
                let args = ipcPacketBuffer.parseArrayAt(1);
                this.emit(ipcBusCommand.channel, ipcBusEvent, ...args);
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
                const localRequestCallback = this._requestFunctions.get(ipcBusCommand.request.replyChannel);
                if (localRequestCallback) {
                    let args = ipcPacketBuffer.parseArrayAt(1);
                    localRequestCallback(ipcBusCommand, args);
                }
                break;
            }
        }
    }

    ipcRequest(channel: string, timeoutDelay: number, args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if (timeoutDelay == null) {
            timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }

        let p = new Promise<IpcBusInterfaces.IpcBusRequestResponse>((resolve, reject) => {
            const ipcBusCommandRequest: IpcBusCommand.Request = { replyChannel: this.generateReplyChannel() };

            // Prepare reply's handler, we have to change the replyChannel to channel
            const localRequestCallback = (ipcBusCommand: IpcBusCommand, args: any[]) => {
                // The channel is not generated one
                let ipcBusEvent: IpcBusInterfaces.IpcBusEvent = { channel: channel, sender: ipcBusCommand.peer };
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Peer #${ipcBusEvent.sender.name} replied to request on ${ipcBusCommand.request.replyChannel}`);
                // Unregister locally
                this._requestFunctions.delete(ipcBusCommand.request.replyChannel);
                // Unregister remotely
                // this.ipcSend(IpcBusCommand.Kind.RequestCancel, IpcBusCommand.Request, ipcBusEvent);
                if (ipcBusCommand.request.resolve) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] resolve`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = { event: ipcBusEvent, payload: args[0] };
                    resolve(response);
                }
                else if (ipcBusCommand.request.reject) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] reject`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = { event: ipcBusEvent, err: args[0] };
                    reject(response);
                }
                else {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] reject: unknown format`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = { event: ipcBusEvent, err: 'unknown format' };
                    reject(response);
                }
            };

            // Register locally
            this._requestFunctions.set(ipcBusCommandRequest.replyChannel, localRequestCallback);
            // Execute request
            this.ipcSend(IpcBusCommand.Kind.RequestMessage, channel, ipcBusCommandRequest, args);

            // Clean-up
            if (timeoutDelay >= 0) {
                setTimeout(() => {
                    if (this._requestFunctions.delete(ipcBusCommandRequest.replyChannel)) {
                        // Unregister remotely
                        this.ipcSend(IpcBusCommand.Kind.RequestCancel, channel, ipcBusCommandRequest);
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] reject: timeout`);
                        let response: IpcBusInterfaces.IpcBusRequestResponse = { event: { channel: channel, sender: this._ipcBusPeer }, err: 'timeout' };
                        reject(response);
                    }
                }, timeoutDelay);
            }
        });
        return p;
    }

    protected ipcSend(kind: IpcBusCommand.Kind, channel: string, ipcBusCommandRequest?: IpcBusCommand.Request, args?: any[]): void {
        this.ipcPostCommand({ kind, channel, peer: this.peer, request: ipcBusCommandRequest }, args);
    }

    protected abstract ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;
}
