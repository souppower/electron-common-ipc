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

    _onRendererMessagedReceived(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        this._packet.setRawContent(rawContent);
        this.addLog(ipcBusCommand, this._packet.parseArrayAt(1));
        super._onRendererMessagedReceived(ipcBusCommand, rawContent);
    }

    _onMainMessageReceived(ipcBusCommand: IpcBusCommand, args?: any[]) {
        this.addLog(ipcBusCommand, args);
        super._onMainMessageReceived(ipcBusCommand, args);
    }

    _onNetMessageReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        this.addLog(ipcBusCommand, ipcPacketBuffer.parseArrayAt(1));
        super._onNetMessageReceived(ipcBusCommand, ipcPacketBuffer);
    }

}

