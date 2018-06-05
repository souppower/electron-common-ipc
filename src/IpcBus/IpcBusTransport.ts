import * as IpcBusInterfaces from './IpcBusInterfaces';
import { IpcBusCommand } from './IpcBusCommand';

/** @internal */
export interface IpcBusTransport {
    readonly peer: IpcBusInterfaces.IpcBusPeer;

    readonly client: IpcBusInterfaces.IpcBusClient;

    ipcConnect(options: IpcBusInterfaces.IpcBusClient.ConnectOptions): Promise<void>;
    ipcClose(options?: IpcBusInterfaces.IpcBusClient.CloseOptions): Promise<void>;
    ipcSend(kind: IpcBusCommand.Kind, channel: string, ipcBusCommandRequest?: IpcBusCommand.Request, args?: any[]): void;
    ipcRequest(channel: string, timeoutDelay: number, args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse>;
}
