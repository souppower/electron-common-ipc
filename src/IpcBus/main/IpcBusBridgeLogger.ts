import * as Client from '../IpcBusClient';

import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcPacketBuffer } from 'socket-serializer';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export abstract class IpcBusBridgeLogger extends IpcBusBridgeImpl {
    constructor(contextType: Client.IpcBusProcessType) {
        super(contextType);
    }

    protected abstract addLog(ipcBusCommand: IpcBusCommand, args: any[]): void;

    _onCommonMessage(origin: 'broker'| 'renderer'| 'main', event: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        const ipcPacketBuffer = new IpcPacketBuffer(rawContent);
        this.addLog(ipcBusCommand, ipcPacketBuffer.parseArrayAt(1));
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(log);
        super._onCommonMessage(origin, event, ipcBusCommand, rawContent);
    }
}

