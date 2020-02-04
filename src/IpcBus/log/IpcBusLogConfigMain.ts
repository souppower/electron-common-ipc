import { IpcPacketBuffer } from "socket-serializer";

import { IpcBusCommand } from "../IpcBusCommand";
import { IpcBusLog } from './IpcBusLog';
import { IpcBusLogConfigImpl } from './IpcBusLogConfigImpl';
import { IpcBusLogConfig } from './IpcBusLogConfig';
import { CreateIpcBusLog } from "./IpcBusLog-factory";

/** @internal */
export interface IpcBusLogMain extends IpcBusLogConfig {
    getCallback(): IpcBusLog.Callback;
    setCallback(cb?: IpcBusLog.Callback): void;
    addLog(command: IpcBusCommand, args: any[], payload?: number): boolean;
    addLogRawContent(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): boolean;
    addLogPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): boolean;
}

/** @internal */
export class IpcBusLogConfigMain extends IpcBusLogConfigImpl implements IpcBusLogMain {
    private _cb: IpcBusLog.Callback;
    protected _packet: IpcPacketBuffer;
    protected _order: number;

    constructor() {
        super();
        this._packet = new IpcPacketBuffer();
        this._order = 0;
    }

    getCallback(): IpcBusLog.Callback {
        return this._cb;
    }

    setCallback(cb?: IpcBusLog.Callback): void {
        this._cb = cb;
    }

    addLog(ipcBusCommand: IpcBusCommand, args: any[], payload?: number): boolean {
        ++this._order;
        // Some C++ lib can not manage log, so we have to simulate the minimum at this level
        if (ipcBusCommand.log == null) {
            const id = `external-${ipcBusCommand.peer.id}-${this._order}`;
            ipcBusCommand.log = ipcBusCommand.log || {
                id,
                timestamp: this.now
            };
        }

        let source_command = ipcBusCommand;
        while (source_command.log.previous) {
            const previous = source_command.log.previous;
            if (previous.log == null) {
                break;
            }
            source_command = previous;
        }

        const trace: Partial<IpcBusLog.Trace> = {
            order: this._order,
            args
        };

        trace.peer = trace.peer_source = source_command.peer;
        trace.timestamp = trace.timestamp_source = (source_command.log.timestamp - this.baseTime);

        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                trace.kind = source_command.request ? IpcBusLog.Kind.SEND_REQUEST : IpcBusLog.Kind.SEND_MESSAGE;
                trace.channel = source_command.channel;
                trace.payload = payload;
                break;
            }
            case IpcBusCommand.Kind.RequestClose: {
                trace.peer = ipcBusCommand.peer;
                trace.timestamp = ipcBusCommand.log.timestamp - this.baseTime;
                trace.local = ipcBusCommand.log.local;

                trace.kind = IpcBusLog.Kind.SEND_CLOSE_REQUEST;
                trace.channel = ipcBusCommand.request.channel;
                trace.request = ipcBusCommand.request;
                trace.payload = payload;
                break;
            }
            case IpcBusCommand.Kind.RequestResponse:
            case IpcBusCommand.Kind.LogRequestResponse: {
                trace.peer = ipcBusCommand.peer;
                trace.timestamp = ipcBusCommand.log.timestamp - this.baseTime;
                trace.local = ipcBusCommand.log.local;

                trace.kind = IpcBusLog.Kind.SEND_REQUEST_RESPONSE;
                trace.channel = ipcBusCommand.request.channel;
                trace.request = ipcBusCommand.request;
                trace.payload = payload;
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
                else if (current_command.kind === IpcBusCommand.Kind.RequestClose) {
                    trace.kind = IpcBusLog.Kind.GET_CLOSE_REQUEST;
                }
                trace.channel = current_command.channel;
                trace.request = current_command.request;
                break;
            }
        }
        trace.id = `${source_command.log.id}_${trace.kind}`;

        this._cb(trace as IpcBusLog.Trace);
        return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);
    }

    addLogRawContent(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): boolean {
        if (ipcBusCommand.log) {
            this._packet.setRawContent(rawContent);
            this.addLog(ipcBusCommand, this._packet.parseArrayAt(1), this._packet.buffer.length);
        }
        return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);
    }

    addLogPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): boolean {
        if (ipcBusCommand.log) {
            this.addLog(ipcBusCommand, ipcPacketBuffer.parseArrayAt(1), ipcPacketBuffer.buffer.length);
        }
        return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);
    }
}

IpcBusLog.SetLogLevel = (level: IpcBusLogConfig.Level, cb?: IpcBusLog.Callback): void => {
    const logger = CreateIpcBusLog() as IpcBusLogMain;
    logger.level = level;
    logger.setCallback(cb);
}



