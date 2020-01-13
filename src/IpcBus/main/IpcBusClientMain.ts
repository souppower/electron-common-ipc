import * as Client from '../IpcBusClient';

import { IpcBusClientImpl}  from '../IpcBusClientImpl';
import { IpcBusTransport } from '../IpcBusTransport';
import { CreateIpcBusBridge } from './IpcBusBridge-factory';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusTransportMultiImpl } from '../IpcBusTransportMultIImpl';
import { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusTransportImpl } from '../IpcBusTransportImpl';

export function CreateConnector(contextType: Client.IpcBusProcessType): IpcBusConnector {
    const bridge = CreateIpcBusBridge() as IpcBusBridgeImpl;
    const connector = bridge.mainConnector;
    return connector;
}

let g_transport: IpcBusTransportImpl;
export function CreateTransport(contextType: Client.IpcBusProcessType): IpcBusTransport {
    const connector = CreateConnector(contextType);
    g_transport = g_transport || new IpcBusTransportMultiImpl(connector);
    connector.addClient(g_transport);
    return g_transport;
}

// Implementation for Electron Main process
export function Create(contextType: Client.IpcBusProcessType): Client.IpcBusClient {
    const transport = CreateTransport(contextType);
    const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
