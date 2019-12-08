import * as Client from './IpcBusClient';

import { IpcBusTransportNet } from './IpcBusTransportNet';
import { IpcBusClientImpl}  from './IpcBusClientImpl';

// Implementation for Node process
export function Create(contextType: Client.IpcBusProcessType): Client.IpcBusClient {
    const transport = new IpcBusTransportNet(contextType);
    const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
