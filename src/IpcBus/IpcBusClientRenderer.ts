import * as Client from './IpcBusClient';

import { IpcBusTransportWindow, IpcWindow } from './IpcBusTransportWindow';
import { IpcBusClientImpl}  from './IpcBusClientImpl';

// Implementation for Renderer process
export function Create(options: Client.IpcBusClient.CreateOptions, ipcWindow: IpcWindow): Client.IpcBusClient {
    let transport = new IpcBusTransportWindow('renderer', options, ipcWindow);
    let ipcClient = new IpcBusClientImpl(options, transport);
    return ipcClient;
}
