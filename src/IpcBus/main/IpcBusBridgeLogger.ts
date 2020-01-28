import * as Client from '../IpcBusClient';

import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcPacketBuffer } from 'socket-serializer';
import { IpcBusLog } from '../log/IpcBusLog';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeLogger extends IpcBusBridgeImpl {
    private _ipcBusLog: IpcBusLog;

    constructor(contextType: Client.IpcBusProcessType, ipcBusLog: IpcBusLog) {
        super(contextType);
        this._ipcBusLog = ipcBusLog;
    }

    _onRendererMessagedReceived(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        if (this._ipcBusLog.addLogRawContent(ipcBusCommand, rawContent)) {
            super._onRendererMessagedReceived(ipcBusCommand, rawContent);
        }
    }

    _onMainMessageReceived(ipcBusCommand: IpcBusCommand, args?: any[]) {
        if (this._ipcBusLog.addLog(ipcBusCommand, args)) {
            super._onMainMessageReceived(ipcBusCommand, args);
        }
    }

    _onNetMessageReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        if (this._ipcBusLog.addLogPacket(ipcBusCommand, ipcPacketBuffer)) {
            super._onNetMessageReceived(ipcBusCommand, ipcPacketBuffer);
        }
    }

}

