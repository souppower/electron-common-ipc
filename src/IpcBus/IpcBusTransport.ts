import { EventEmitter } from 'events';

import * as Client from './IpcBusClient';
import { IpcBusCommand } from './IpcBusCommand';

/** @internal */
export namespace IpcBusTransport {
    /** @internal */
    export interface Client extends EventEmitter {
        peer: Client.IpcBusPeer;
    }
}

/** @internal */
export interface IpcBusTransport {
    ipcConnect(client: IpcBusTransport.Client, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer>;
    ipcClose(client: IpcBusTransport.Client, options?: Client.IpcBusClient.CloseOptions): Promise<void>;

    hasChannel(channel: string): boolean;
    getChannels(): string[];

    ipcAddChannels(client: IpcBusTransport.Client, channels: string[]): void;
    ipcRemoveChannels(client: IpcBusTransport.Client, channels: string[]): void;

    ipcRequestMessage(client: IpcBusTransport.Client, channel: string, timeoutDelay: number, args: any[]): Promise<Client.IpcBusRequestResponse>;
    ipcSendMessage(client: IpcBusTransport.Client, channel: string, args: any[]): void;
    ipcPost(peer: Client.IpcBusPeer, kind: IpcBusCommand.Kind, channel: string, args?: any[]): void;
}
