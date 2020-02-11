import * as Client from '../IpcBusClient';

import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcPacketBuffer } from 'socket-serializer';
import { IpcBusLogMain } from '../log/IpcBusLogConfigMain';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeLogger extends IpcBusBridgeImpl {
    private _ipcBusLog: IpcBusLogMain;

    constructor(contextType: Client.IpcBusProcessType, ipcBusLog: IpcBusLogMain) {
        super(contextType);
        this._ipcBusLog = ipcBusLog;
    }

    addLog(command: IpcBusCommand, args: any[], payload?: number): boolean {
        return this._ipcBusLog.addLog(command, args);
    }

    addLogRawContent(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): boolean {
        return this._ipcBusLog.addLogRawContent(ipcBusCommand, rawContent);
    }

    addLogPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): boolean {
        return this._ipcBusLog.addLogPacket(ipcBusCommand, ipcPacketBuffer);
    }
    
    _onRendererArgsReceived(ipcBusCommand: IpcBusCommand, args: any[]) {
        if (this._ipcBusLog.addLog(ipcBusCommand, args)) {
            super._onRendererArgsReceived(ipcBusCommand, args);
        }
    }

    _onRendererRawContentReceived(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        if (this._ipcBusLog.addLogRawContent(ipcBusCommand, rawContent)) {
            super._onRendererRawContentReceived(ipcBusCommand, rawContent);
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

