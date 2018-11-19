import * as assert from 'assert';

import * as Client from './IpcBusClient';

import { IpcBusClientTransportRenderer, IpcBusTransportInWindow } from './IpcBusClientTransportRenderer';

// Implementation for renderer-frame process
/** @internal */
export class IpcBusClientTransportRendererFrame extends IpcBusClientTransportRenderer {
    constructor(contextType: Client.IpcBusContextType, options: Client.IpcBusClient.CreateOptions, ipcTransportInWindow: IpcBusTransportInWindow) {
        assert(contextType === 'renderer-frame', `IpcBusClientTransportRendererFrame: contextType must not be a ${contextType}`);
        super(contextType, options, ipcTransportInWindow);
    }
}

