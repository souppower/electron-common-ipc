import { IpcPacketBuffer } from "socket-serializer";

import { IpcBusCommand } from "../IpcBusCommand";
import { IpcBusLog } from './IpcBusLog';
import { IpcBusLogConfig } from './IpcBusLogConfig';
import { ipcBusLogConfig } from './IpcBusLogConfigImpl';

/** @internal */
export interface IpcBusLogMain extends IpcBusLogConfig {
    getCallback(): IpcBusLog.Callback;
    setCallback(cb?: IpcBusLog.Callback): void;
    addLog(command: IpcBusCommand, args: any[]): boolean;
    addLogRawContent(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): boolean;
    addLogPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): boolean;
}

/** @internal */
export class IpcBusLogMainImpl implements IpcBusLogMain {
    private _cb: IpcBusLog.Callback;
    protected _packet: IpcPacketBuffer;
    protected _order: number;

    constructor() {
        this._packet = new IpcPacketBuffer();
        this._order = 0;
    }

    get level(): IpcBusLogConfig.Level {
        return ipcBusLogConfig.level;
    }

    set level(level: IpcBusLogConfig.Level) {
        ipcBusLogConfig.level = level;
    }

    get baseTime(): number {
        return ipcBusLogConfig.baseTime;
    }

    set baseTime(baseTime: number) {
        ipcBusLogConfig.baseTime = baseTime;
    }

    getCallback(): IpcBusLog.Callback {
        return this._cb;
    }

    setCallback(cb?: IpcBusLog.Callback): void {
        this._cb = cb;
    }

    addLog(ipcBusCommand: IpcBusCommand, args: any[]): boolean {
        ++this._order;
        // Some C++ lib can not manage log, so we have to simulate the minimum at this level
        if (ipcBusCommand.log == null) {
            const id = `external-${this._order}`;
            ipcBusCommand.log = ipcBusCommand.log || {
                id,
                timestamp: Date.now()
            };
        }

        let source_command = ipcBusCommand;
        while (source_command.log?.previous) {
            source_command = source_command.log.previous;
        }

        const trace: Partial<IpcBusLog.Trace> = {
            order: this._order
        };

        trace.peer = trace.peer_source = source_command.peer;
        trace.timestamp = trace.timestamp_source = source_command.log.timestamp - this.baseTime;
        trace.channel = source_command.channel;

        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                trace.kind = source_command.request ? IpcBusLog.Kind.SEND_REQUEST : IpcBusLog.Kind.SEND_MESSAGE;
                break;
            }
            case IpcBusCommand.Kind.RequestResponse:
            case IpcBusCommand.Kind.LogRequestResponse: {
                const current_command = ipcBusCommand;
                trace.peer = current_command.peer;
                trace.timestamp = current_command.log.timestamp - this.baseTime;
                trace.local = current_command.log.local;
                trace.kind = IpcBusLog.Kind.SEND_REQUEST_RESPONSE
                break;
            }
            case IpcBusCommand.Kind.LogGetMessage: {
                trace.peer = ipcBusCommand.peer;
                trace.timestamp = ipcBusCommand.log.timestamp - this.baseTime;
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
        trace.id = `${source_command.log.id}_${trace.kind}`;
        trace.args = args;

        this._cb(trace as IpcBusLog.Trace);
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
export const ipcBusLog = new IpcBusLogMainImpl();

IpcBusLog.SetLogLevel = (level: IpcBusLogConfig.Level, cb?: IpcBusLog.Callback): void => {
    ipcBusLog.level = level;
    ipcBusLog.setCallback(cb);
}



