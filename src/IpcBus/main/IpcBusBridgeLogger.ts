import { IpcPacketBuffer } from 'socket-serializer';

import * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusLogMain } from '../log/IpcBusLogConfigMain';
import { IpcBusContent } from '../IpcBusContent';

import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';

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

    addLogRawContent(ipcBusCommand: IpcBusCommand, ipcBusContent: IpcBusContent): boolean {
        return this._ipcBusLog.addLogRawContent(ipcBusCommand, ipcBusContent);
    }

    addLogPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): boolean {
        return this._ipcBusLog.addLogPacket(ipcBusCommand, ipcPacketBuffer);
    }
    
    // _onRendererArgsReceived(ipcBusCommand: IpcBusCommand, args: any[]) {
    //     if (this._ipcBusLog.addLog(ipcBusCommand, args)) {
    //         super._onRendererArgsReceived(ipcBusCommand, args);
    //     }
    // }

    _onRendererRawContentReceived(ipcBusCommand: IpcBusCommand, ipcBusContent: IpcBusContent) {
        if (this._ipcBusLog.addLogRawContent(ipcBusCommand, ipcBusContent)) {
            super._onRendererRawContentReceived(ipcBusCommand, ipcBusContent);
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

