import * as Client from '../IpcBusClient';

import { IpcBusTransportWindow  } from './IpcBusTransportWindow';
import { IpcWindow  } from '../renderer/IpcBusTransportIpc';
import { IpcBusClientImpl}  from '../IpcBusClientImpl';

// Implementation for Renderer process
export function Create(contextType: Client.IpcBusProcessType, ipcWindow: IpcWindow): Client.IpcBusClient {
    const transport = new IpcBusTransportWindow(contextType, ipcWindow);
    const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
