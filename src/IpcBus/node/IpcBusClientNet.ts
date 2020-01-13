import * as Client from '../IpcBusClient';

import { IpcBusConnectorNet } from './IpcBusConnectorNet';
import { IpcBusClientImpl}  from '../IpcBusClientImpl';
import { IpcBusTransport } from '../IpcBusTransport';
import { IpcBusTransportSingleImpl } from '../IpcBusTransportSingleImpl';
import { IpcBusConnector } from '../IpcBusConnector';

export function CreateConnector(contextType: Client.IpcBusProcessType): IpcBusConnector {
    const connector = new IpcBusConnectorNet(contextType);
    return connector;
}

export function CreateTransport(contextType: Client.IpcBusProcessType): IpcBusTransport {
    const connector = CreateConnector(contextType);
    const transport = new IpcBusTransportSingleImpl(connector);
    return transport;
}

// Implementation for Node process
export function Create(contextType: Client.IpcBusProcessType): Client.IpcBusClient {
    const transport = CreateTransport(contextType);
    const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
