import * as Client from './IpcBusClient';
import { IpcBusCommand } from './IpcBusCommand';
import { EventEmitter } from 'events';

export interface IpcBusSender {
    send(channel: string, ...args: any[]): void;
}

export interface IpcBusTransportClient extends EventEmitter {
    peer: Client.IpcBusPeer;
}

/** @internal */
export interface IpcBusTransport {
    ipcHandshake(options: Client.IpcBusClient.ConnectOptions): Promise<void>;
    ipcShutdown(options: Client.IpcBusClient.CloseOptions): Promise<void>;

    ipcConnect(client: IpcBusTransportClient, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer>;
    ipcClose(client: IpcBusTransportClient, options?: Client.IpcBusClient.CloseOptions): Promise<void>;

    ipcAddChannelListener(client: IpcBusTransportClient, channel: string): void;
    ipcRemoveChannelListener(client: IpcBusTransportClient, channel: string): void;
    ipcRemoveAllListeners(client: IpcBusTransportClient, channel?: string): void;

    ipcRequestMessage(client: IpcBusTransportClient, channel: string, timeoutDelay: number, args: any[]): Promise<Client.IpcBusRequestResponse>;
    ipcSendMessage(client: IpcBusTransportClient, channel: string, args: any[]): void;
    ipcPost(peer: Client.IpcBusPeer, kind: IpcBusCommand.Kind, channel: string, args?: any[]): void;
}
