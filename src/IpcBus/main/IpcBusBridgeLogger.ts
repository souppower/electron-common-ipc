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

    addLogRawContent(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        this._packet.setRawContent(rawContent);
        this.addLog(ipcBusCommand, this._packet.parseArrayAt(1));
        return (ipcBusCommand.kind !== IpcBusCommand.Kind.Log);
    }

    addLogPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        this.addLog(ipcBusCommand, ipcPacketBuffer.parseArrayAt(1));
        return (ipcBusCommand.kind !== IpcBusCommand.Kind.Log);
    }

    _onRendererMessagedReceived(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        if (this.addLogRawContent(ipcBusCommand, rawContent)) {
            super._onRendererMessagedReceived(ipcBusCommand, rawContent);
        }
    }

    _onMainMessageReceived(ipcBusCommand: IpcBusCommand, args?: any[]) {
        if (this.addLog(ipcBusCommand, args)) {
            super._onMainMessageReceived(ipcBusCommand, args);
        }
    }

    _onNetMessageReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        if (this.addLogPacket(ipcBusCommand, ipcPacketBuffer)) {
            super._onNetMessageReceived(ipcBusCommand, ipcPacketBuffer);
        }
    }

}

