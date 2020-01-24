import * as Client from '../IpcBusClient';

import { IpcBusConnectorRenderer  } from './IpcBusConnectorRenderer';
import { IpcWindow } from './IpcBusConnectorRenderer';
import { IpcBusClientImpl} from '../IpcBusClientImpl';
import { IpcBusTransport } from '../IpcBusTransport';
import { IpcBusTransportMultiImpl } from '../IpcBusTransportMultiImpl';
import { IpcBusConnector } from '../IpcBusConnector';

export function CreateConnector(contextType: Client.IpcBusProcessType, ipcWindow: IpcWindow): IpcBusConnector {
    const connector = new IpcBusConnectorRenderer(contextType, ipcWindow);
    return connector;
}

export function CreateTransport(contextType: Client.IpcBusProcessType, ipcWindow: IpcWindow): IpcBusTransport {
    const connector = CreateConnector(contextType, ipcWindow);
    const transport = new IpcBusTransportMultiImpl(connector);
    return transport;
}

// Implementation for Renderer process
export function Create(contextType: Client.IpcBusProcessType, ipcWindow: IpcWindow): Client.IpcBusClient {
    const transport = CreateTransport(contextType, ipcWindow);
    const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
