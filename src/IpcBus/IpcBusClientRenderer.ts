import * as Client from './IpcBusClient';

import { IpcBusClientTransportWindow, IpcBusTransportWindow } from './IpcBusClientTransportWindow';

// Implementation for renderer process
/** @internal */
export class IpcBusClientRenderer extends IpcBusClientTransportWindow {
    constructor(options: Client.IpcBusClient.CreateOptions, ipcTransportWindow: IpcBusTransportWindow) {
        super('renderer', options, ipcTransportWindow);
    }
}

