import * as Client from './IpcBusClient';
import { IpcBusCommand } from './IpcBusCommand';

/** @internal */
export interface IpcBusClientTransport {
    ipcConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void>;
    ipcClose(options?: Client.IpcBusClient.CloseOptions): Promise<void>;
    ipcRequest(channel: string, timeoutDelay: number, args: any[]): Promise<Client.IpcBusRequestResponse>
    ipcSend(kind: IpcBusCommand.Kind, channel: string, ipcBusCommandRequest?: IpcBusCommand.Request, args?: any[]): void;
}
