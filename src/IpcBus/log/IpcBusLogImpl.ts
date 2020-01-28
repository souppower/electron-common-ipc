import { IpcPacketBuffer } from "socket-serializer";

import { IpcBusCommand } from "../IpcBusCommand";

import { IpcBusLog } from './IpcBusLog';

export class IpcBusLogImpl implements IpcBusLog {
    private _logLevel: number;
    private _cb: IpcBusLog.Callback;
    protected _packet: IpcPacketBuffer;

    constructor() {
        this._logLevel = IpcBusLog.Level.None;
        this._packet = new IpcPacketBuffer();
    }

    getCallback(): IpcBusLog.Callback {
        return this._cb;
    }

    getLogLevel(): number {
        // In renderer process, there is no process object
        if (process && process.env) {
            const logLevelAny = process.env['ELECTRON_IPC_LEVEL'];
            let logLevel = Number(logLevelAny);
            logLevel = Math.min(logLevel, 3);
            logLevel = Math.max(logLevel, 0);
            return logLevel;
        }
        return this._logLevel;
    }
        
    setLogLevel(logLevel: IpcBusLog.Level, cb?: IpcBusLog.Callback): void {
        if (process && process.env) {
            process.env['ELECTRON_IPC_LEVEL'] = logLevel.toString();
        }
        this._logLevel = logLevel;
        this._cb = cb;
    }

    addLog(ipcBusCommand: IpcBusCommand, args: any[]): boolean {
        this._cb(ipcBusCommand, args);
        return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);
    }

    addLogRawContent(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): boolean {
        this._packet.setRawContent(rawContent);
        this.addLog(ipcBusCommand, this._packet.parseArrayAt(1));
        return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);
    }

    addLogPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): boolean {
        this.addLog(ipcBusCommand, ipcPacketBuffer.parseArrayAt(1));
        return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);
    }
}

export const logManager = new IpcBusLogImpl();

export function GetLogLevel(): IpcBusLog.Level {
    return logManager.getLogLevel();
}

export function SetLogLevel(level: IpcBusLog.Level, cb?: IpcBusLog.Callback): void {
    return logManager.setLogLevel(level, cb);
}


