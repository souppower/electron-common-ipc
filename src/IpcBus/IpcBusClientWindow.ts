import * as Client from './IpcBusClient';

import { IpcBusTransportWindow, IpcWindow } from './IpcBusTransportWindow';
import { IpcBusClientImpl}  from './IpcBusClientImpl';

// Implementation for Renderer process
export function Create(contextType: Client.IpcBusProcessType, options: Client.IpcBusClient.CreateOptions, ipcWindow: IpcWindow): Client.IpcBusClient {
    let transport = new IpcBusTransportWindow(contextType, options, ipcWindow);
    let ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
