import * as Client from '../IpcBusClient';

import { IpcBusTransportMain } from './IpcBusTransportMain';
import { IpcBusClientImpl}  from '../IpcBusClientImpl';
import { IpcBusTransport } from '../IpcBusTransport';

let g_transport: IpcBusTransportMain;
export function CreateTransport(contextType: Client.IpcBusProcessType): IpcBusTransport {
    g_transport = g_transport || new IpcBusTransportMain(contextType);
    return g_transport;
}

// Implementation for Electron Main process
export function Create(contextType: Client.IpcBusProcessType): Client.IpcBusClient {
    const transport = CreateTransport(contextType);
    const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
