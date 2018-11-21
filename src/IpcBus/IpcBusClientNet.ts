import * as Client from './IpcBusClient';

import { IpcBusTransportNet } from './IpcBusTransportNet';
import { IpcBusClientImpl}  from './IpcBusClientImpl';

// Implementation for Node process
export function Create(contextType: Client.IpcBusProcessType, options: Client.IpcBusClient.CreateOptions): Client.IpcBusClient {
    let transport = new IpcBusTransportNet(contextType, options);
    let ipcClient = new IpcBusClientImpl(options, transport);
    return ipcClient;
}
