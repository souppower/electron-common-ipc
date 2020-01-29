import { IpcPacketBuffer } from "socket-serializer";

import { IpcBusCommand } from "../IpcBusCommand";
import { IpcBusLog } from './IpcBusLog';

/** @internal */
export interface IpcBusLog {
    getCallback(): IpcBusLog.Callback;
    getLogLevel(): number;
    setLogLevel(logLevel: IpcBusLog.Level, cb?: IpcBusLog.Callback): void;
    addLog(command: IpcBusCommand, args: any[]): boolean;
    addLogRawContent(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): boolean;
    addLogPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): boolean;
}


/** @internal */
export class IpcBusLogImpl implements IpcBusLog {
    private _logLevel: number;
    private _cb: IpcBusLog.Callback;
    protected _packet: IpcPacketBuffer;
    protected _order: number;

    constructor() {
        this._logLevel = IpcBusLog.Level.None;
        this._packet = new IpcPacketBuffer();
        this._order = 0;
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
        if (ipcBusCommand.log) {
            ++this._order;
            const trace: Partial<IpcBusLog.Trace> = {
                order: this._order
            };

            let source_command = ipcBusCommand;
            while (source_command.log.previous) {
                source_command = source_command.log.previous;
            }
            trace.id = source_command.log.id;
            trace.peer = trace.peer_source = source_command.peer;
            trace.timestamp = trace.timestamp_source = source_command.log.timestamp;
            trace.channel = source_command.channel;
            trace.args = args;

            switch (ipcBusCommand.kind) {
                case IpcBusCommand.Kind.SendMessage: {
                    trace.kind = source_command.request ? IpcBusLog.Kind.SEND_REQUEST : IpcBusLog.Kind.SEND_MESSAGE;
                    break;
                }
                case IpcBusCommand.Kind.RequestResponse:
                case IpcBusCommand.Kind.LogRequestResponse: {
                    const current_command = ipcBusCommand;
                    trace.peer = current_command.peer;
                    trace.timestamp = current_command.log.timestamp;
                    trace.local = current_command.log.local;
                    trace.kind = IpcBusLog.Kind.SEND_REQUEST_RESPONSE
                    break;
                }
                case IpcBusCommand.Kind.LogGetMessage: {
                    trace.peer = ipcBusCommand.peer;
                    trace.timestamp = ipcBusCommand.log.timestamp;
                    trace.local = ipcBusCommand.log.local;

                    const current_command = ipcBusCommand.log.previous;
                    if (current_command.kind === IpcBusCommand.Kind.SendMessage) {
                        trace.kind = current_command.request ? IpcBusLog.Kind.GET_REQUEST : IpcBusLog.Kind.GET_MESSAGE;
                    }
                    else if (current_command.kind === IpcBusCommand.Kind.RequestResponse) {
                        trace.kind = IpcBusLog.Kind.GET_REQUEST_RESPONSE;
                    }
                    break;
                }
            }
            this._cb(trace as IpcBusLog.Trace);
        }
        return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);
    }

    addLogRawContent(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): boolean {
        if (ipcBusCommand.log) {
            this._packet.setRawContent(rawContent);
            this.addLog(ipcBusCommand, this._packet.parseArrayAt(1));
        }
        return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);
    }

    addLogPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): boolean {
        if (ipcBusCommand.log) {
            this.addLog(ipcBusCommand, ipcPacketBuffer.parseArrayAt(1));
        }
        return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);
    }
}

/** @internal */
export const logManager = new IpcBusLogImpl();

IpcBusLog.GetLogLevel = (): IpcBusLog.Level => {
    return logManager.getLogLevel();
}

IpcBusLog.SetLogLevel = (level: IpcBusLog.Level, cb?: IpcBusLog.Callback): void => {
    return logManager.setLogLevel(level, cb);
}


