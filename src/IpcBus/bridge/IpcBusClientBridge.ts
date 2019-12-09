import * as Client from '../IpcBusClient';

import { IpcBusTransportBridge } from './IpcBusTransportBridge';
import { IpcBusClientImpl}  from '../IpcBusClientImpl';

// Implementation for Electron Main process
export function Create(contextType: Client.IpcBusProcessType): Client.IpcBusClient {
    const transport = new IpcBusTransportBridge(contextType);
    const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
