import * as Client from '../IpcBusClient';

import { IpcBusClientImpl}  from '../IpcBusClientImpl';
import { IpcBusTransport } from '../IpcBusTransport';
import { CreateIpcBusBridge } from './IpcBusBridge-factory';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';

export function CreateTransport(contextType: Client.IpcBusProcessType): IpcBusTransport {
    const bridge = CreateIpcBusBridge() as IpcBusBridgeImpl;
    return bridge.mainTransport;
}

// Implementation for Electron Main process
export function Create(contextType: Client.IpcBusProcessType): Client.IpcBusClient {
    const transport = CreateTransport(contextType);
    const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
