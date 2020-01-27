import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as Client from '../IpcBusClient';

import { IpcBusConnectorNet } from './IpcBusConnectorNet';
import { IpcBusClientImpl}  from '../IpcBusClientImpl';
import { IpcBusTransport } from '../IpcBusTransport';
import { IpcBusTransportMultiImpl } from '../IpcBusTransportMultiImpl';
import { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusClientNet } from './IpcBusClientNet';

export const CreateIpcBusNet: Client.IpcBusClient.CreateFunction = (): Client.IpcBusClient => {
    const electronProcessType = GetElectronProcessType();
    return Create(electronProcessType);
}
IpcBusClientNet.Create = CreateIpcBusNet;

export function CreateConnector(contextType: Client.IpcBusProcessType): IpcBusConnector {
    const connector = new IpcBusConnectorNet(contextType);
    return connector;
}

let g_transport: IpcBusTransport = null;
export function CreateTransport(contextType: Client.IpcBusProcessType): IpcBusTransport {
    if (g_transport == null) {
        const connector = CreateConnector(contextType);
        g_transport = new IpcBusTransportMultiImpl(connector);
    }
    return g_transport;
}

// Implementation for Node process
export function Create(contextType: Client.IpcBusProcessType): Client.IpcBusClient {
    const transport = CreateTransport(contextType);
    const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
