import * as Client from '../IpcBusClient';

import { IpcBusTransportWindow  } from './IpcBusTransportWindow';
import { IpcWindow } from '../renderer/IpcBusTransportWindow';
import { IpcBusClientImpl} from '../IpcBusClientImpl';
import { IpcBusTransport } from '../IpcBusTransport';

export function CreateTransport(contextType: Client.IpcBusProcessType, ipcWindow: IpcWindow): IpcBusTransport {
    const transport = new IpcBusTransportWindow(contextType, ipcWindow);
    return transport;
}

// Implementation for Renderer process
export function Create(contextType: Client.IpcBusProcessType, ipcWindow: IpcWindow): Client.IpcBusClient {
    const transport = CreateTransport(contextType, ipcWindow);
    const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
