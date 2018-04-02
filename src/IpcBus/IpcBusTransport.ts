/// <reference types='node' />
/// <reference types='uuid' />

import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

import { EventEmitter } from 'events';
import * as uuid from 'uuid';

/** @internal */
function GenerateReplyChannel(): string {
    return '/electron-ipc-bus/request-reply/' + uuid.v1();
}

/** @internal */
export class IpcBusData {
    replyChannel?: string;
    resolve?: boolean;
    reject?: boolean;
    unsubscribeAll?: boolean;
}

/** @internal */
export class IpcBusCommand {
//    readonly type = 'IpcBusCommand';
    kind: IpcBusCommand.Kind;
    channel: string;
    peer: IpcBusInterfaces.IpcBusPeer;
    data?: IpcBusData;
}

/** @internal */
export namespace IpcBusCommand {
    export enum Kind {
        Connect             = 'CO', // 'IpcBusCommand:connect';
        Disconnect          = 'DI', // 'IpcBusCommand:disconnect';
        Close               = 'CL', // 'IpcBusCommand:close';
        SubscribeChannel    = 'SC', // 'IpcBusCommand:subscribeChannel';
        UnsubscribeChannel  = 'UC', // 'IpcBusCommand:unsubscribeChannel';
        UnsubscribeAll      = 'UA', // 'IpcBusCommand:unsubscribeAll';
        SendMessage         = 'SM', // 'IpcBusCommand:sendMessage';
        RequestMessage      = 'RM', // 'IpcBusCommand:requestMessage';
        RequestResponse     = 'RR', // 'IpcBusCommand:requestResponse';
        RequestCancel       = 'RC'  // 'IpcBusCommand:requestCancel';
    };

    // export const IPC_BUS_COMMAND_CONNECT = 'IpcBusCommand:connect';
    // export const IPC_BUS_COMMAND_DISCONNECT = 'IpcBusCommand:disconnect';
    // export const IPC_BUS_COMMAND_CLOSE = 'IpcBusCommand:close';
    // export const IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL = 'IpcBusCommand:subscribeChannel';
    // export const IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL = 'IpcBusCommand:unsubscribeChannel';
    // export const IPC_BUS_COMMAND_UNSUBSCRIBE_ALL = 'IpcBusCommand:unsubscribeAll';
    // export const IPC_BUS_COMMAND_SENDMESSAGE = 'IpcBusCommand:sendMessage';
    // export const IPC_BUS_COMMAND_REQUESTMESSAGE = 'IpcBusCommand:requestMessage';
    // export const IPC_BUS_COMMAND_REQUESTRESPONSE = 'IpcBusCommand:requestResponse';
    // export const IPC_BUS_COMMAND_REQUESTCANCEL = 'IpcBusCommand:requestCancel';
}


/** @internal */
export abstract class IpcBusTransport {
    protected _ipcBusPeer: IpcBusInterfaces.IpcBusPeer;
    protected _requestFunctions: Map<string, Function>;

    readonly ipcOptions: IpcBusUtils.IpcOptions;
    public eventEmitter: EventEmitter;

    constructor(ipcBusProcess: IpcBusInterfaces.IpcBusProcess, ipcOptions: IpcBusUtils.IpcOptions) {
        this._ipcBusPeer = { id: uuid.v1(), name: '', process: ipcBusProcess };
        this.ipcOptions = ipcOptions;
        this._requestFunctions = new Map<string, Function>();
    }

    get peer(): IpcBusInterfaces.IpcBusPeer {
        return this._ipcBusPeer;
    }

    protected _onEventReceived(ipcBusCommand: IpcBusCommand, args: any[]) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
                const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = { channel: ipcBusCommand.channel, sender: ipcBusCommand.peer };
                this.eventEmitter.emit(ipcBusCommand.channel, ipcBusEvent, ...args);
                break;
            }
            case IpcBusCommand.Kind.RequestMessage: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Emit request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.data.replyChannel}')`);
                let ipcBusEvent: IpcBusInterfaces.IpcBusEvent = { channel: ipcBusCommand.channel, sender: ipcBusCommand.peer };
                ipcBusEvent.request = {
                    resolve: (payload: Object | string) => {
                        ipcBusCommand.data.resolve = true;
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Resolve request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - payload: ${JSON.stringify(payload)}`);
                        this.ipcPushCommand(IpcBusCommand.Kind.RequestResponse, ipcBusCommand.data.replyChannel, ipcBusCommand.data, [payload]);
                    },
                    reject: (err: string) => {
                        ipcBusCommand.data.reject = true;
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Reject request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - err: ${JSON.stringify(err)}`);
                        this.ipcPushCommand(IpcBusCommand.Kind.RequestResponse, ipcBusCommand.data.replyChannel, ipcBusCommand.data, [err]);
                    }
                };
                this.eventEmitter.emit(ipcBusCommand.channel, ipcBusEvent, ...args);
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.data.replyChannel}')`);
                const localRequestCallback = this._requestFunctions.get(ipcBusCommand.data.replyChannel);
                if (localRequestCallback) {
                    localRequestCallback(ipcBusCommand, args);
                }
                break;
            }
        }
    }

    request(timeoutDelay: number, channel: string, args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if ((timeoutDelay == null) || (timeoutDelay <= 0)) {
            timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }

        let p = new Promise<IpcBusInterfaces.IpcBusRequestResponse>((resolve, reject) => {
            const ipcBusData: IpcBusData = { replyChannel: GenerateReplyChannel() };

            // Prepare reply's handler, we have to change the replyChannel to channel
            const localRequestCallback = (ipcBusCommand: IpcBusCommand, args: any[]) => {
                // The channel is not generated one
                let ipcBusEvent: IpcBusInterfaces.IpcBusEvent = { channel: channel, sender: ipcBusCommand.peer };
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Peer #${ipcBusEvent.sender.name} replied to request on ${ipcBusCommand.data.replyChannel}`);
                // Unregister locally
                this._requestFunctions.delete(ipcBusCommand.data.replyChannel);
                // Unregister remotely
                // this.ipcPushCommand(IpcBusCommand.Kind.RequestCancel, IpcBusData, ipcBusEvent);
                if (ipcBusCommand.data.resolve) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] resolve`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = { event: ipcBusEvent, payload: args[0] };
                    resolve(response);
                }
                else if (ipcBusCommand.data.reject) {
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
            this._requestFunctions.set(ipcBusData.replyChannel, localRequestCallback);
            // Execute request
            this.ipcPushCommand(IpcBusCommand.Kind.RequestMessage, channel, ipcBusData, args);

            // Clean-up
            // Below zero = infinite
            if (timeoutDelay >= 0) {
                setTimeout(() => {
                    if (this._requestFunctions.delete(ipcBusData.replyChannel)) {
                        // Unregister remotely
                        this.ipcPushCommand(IpcBusCommand.Kind.RequestCancel, channel, ipcBusData);
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] reject: timeout`);
                        let response: IpcBusInterfaces.IpcBusRequestResponse = { event: { channel: channel, sender: this._ipcBusPeer }, err: 'timeout' };
                        reject(response);
                    }
                }, timeoutDelay);
            }
        });
        return p;
    }

    protected abstract _onClose(): void;

    abstract ipcConnect(timeoutDelay: number, peerName?: string): Promise<string>;
    abstract ipcClose(): void;
    abstract ipcPushCommand(command: IpcBusCommand.Kind, channel: string, ipcBusData: IpcBusData, args?: any[]): void;
}
