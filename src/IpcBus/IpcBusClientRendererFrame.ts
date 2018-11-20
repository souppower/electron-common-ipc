import * as Client from './IpcBusClient';

import { IpcBusClientTransportWindow, IpcBusTransportWindow } from './IpcBusClientTransportWindow';

// Implementation for renderer-frame process
/** @internal */
export class IpcBusClientRendererFrame extends IpcBusClientTransportWindow {
    constructor(options: Client.IpcBusClient.CreateOptions, ipcTransportWindow: IpcBusTransportWindow) {
        super('renderer-frame', options, ipcTransportWindow);
    }
}

