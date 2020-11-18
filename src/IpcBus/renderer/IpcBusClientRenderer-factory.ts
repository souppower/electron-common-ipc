import type * as Client from '../IpcBusClient';

import { IpcBusConnectorRenderer  } from './IpcBusConnectorRenderer';
import type { IpcWindow } from './IpcBusConnectorRenderer';
import { IpcBusClientImpl} from '../IpcBusClientImpl';
import type { IpcBusTransport } from '../IpcBusTransport';
import { IpcBusTransportMultiImpl } from '../IpcBusTransportMultiImpl';
import type { IpcBusConnector } from '../IpcBusConnector';

export function CreateConnector(contextType: Client.IpcBusProcessType, ipcWindow: IpcWindow): IpcBusConnector {
    const connector = new IpcBusConnectorRenderer(contextType, ipcWindow);
    return connector;
}

let g_transport: IpcBusTransport = null;
export function CreateTransport(contextType: Client.IpcBusProcessType, ipcWindow: IpcWindow): IpcBusTransport {
    if (g_transport == null) {
        const connector = CreateConnector(contextType, ipcWindow);
        g_transport = new IpcBusTransportMultiImpl(connector);
    }
    return g_transport;
}

// Implementation for Renderer process
export function Create(contextType: Client.IpcBusProcessType, ipcWindow: IpcWindow): Client.IpcBusClient {
    const transport = CreateTransport(contextType, ipcWindow);
    const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
