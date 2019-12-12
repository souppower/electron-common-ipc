import * as assert from 'assert';

import * as Client from '../IpcBusClient';

import { IpcBusTransportIpc, IpcWindow } from './IpcBusTransportIpc';

// Implementation for renderer process
/** @internal */
export class IpcBusTransportWindow extends IpcBusTransportIpc {
    constructor(contextType: Client.IpcBusProcessType, ipcWindow: IpcWindow) {
        assert(contextType === 'renderer' || contextType === 'renderer-frame', `IpcBusTransportWindow: contextType must not be a ${contextType}`);
        super({ type: contextType, pid: -1 }, ipcWindow);
    }
}
