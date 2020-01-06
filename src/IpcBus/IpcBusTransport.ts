import { EventEmitter } from 'events';

import * as Client from './IpcBusClient';
import { IpcBusCommand } from './IpcBusCommand';

export interface IpcBusSender {
    send(channel: string, ...args: any[]): void;
}

/** @internal */
export namespace IpcBusTransport {
    export interface Callback {
        (channel: string, ipcBusEvent: Client.IpcBusEvent, ...args: any[]): void;
    }
}

/** @internal */
export interface IpcBusTransport {
    readonly peer: Client.IpcBusPeer;

    ipcHandshake(options: Client.IpcBusClient.ConnectOptions): Promise<void>;
    ipcShutdown(options: Client.IpcBusClient.CloseOptions): Promise<void>;
    ipcConnect(eventEmitter: EventEmitter | null, options: Client.IpcBusClient.ConnectOptions): Promise<void>;
    ipcClose(eventEmitter: EventEmitter | null, options?: Client.IpcBusClient.CloseOptions): Promise<void>;
    ipcRequest(channel: string, timeoutDelay: number, args: any[]): Promise<Client.IpcBusRequestResponse>;
    ipcSend(kind: IpcBusCommand.Kind, channel: string, ipcBusCommandRequest?: IpcBusCommand.Request, args?: any[]): void;
}
