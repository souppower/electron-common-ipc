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

    private buildMessage(ipcBusCommand: IpcBusCommand, args?: any[], payload?: number): IpcBusLog.Message {
        const message: Partial<IpcBusLog.Message> = {
            peer: ipcBusCommand.peer,
            timestamp: ipcBusCommand.log.timestamp - this.baseTime,
            local: ipcBusCommand.log.local,
            args: (this._level & IpcBusLogConfig.Level.Args) ? args : undefined,
            payload
        };
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                message.kind = ipcBusCommand.request ? IpcBusLog.Kind.SEND_REQUEST : IpcBusLog.Kind.SEND_MESSAGE;
                message.channel = ipcBusCommand.channel;
                break;
            }
            case IpcBusCommand.Kind.RequestClose: {
                message.kind = IpcBusLog.Kind.SEND_CLOSE_REQUEST;
                message.channel = ipcBusCommand.request.channel;
                message.responseChannel = ipcBusCommand.request.replyChannel;
                message.responseStatus = 'rejected';
                break;
            }
            case IpcBusCommand.Kind.RequestResponse:
            case IpcBusCommand.Kind.LogRequestResponse: {
                message.kind = IpcBusLog.Kind.SEND_REQUEST_RESPONSE;
                message.channel = ipcBusCommand.request.channel;
                message.responseChannel = ipcBusCommand.request.replyChannel;
                message.responseStatus = ipcBusCommand.request.resolve ? 'resolved' : 'rejected';
                break;
            }
            case IpcBusCommand.Kind.LogGetMessage: {
                const current_command = ipcBusCommand.log.previous;
                if (current_command.kind === IpcBusCommand.Kind.SendMessage) {
                    message.kind = current_command.request ? IpcBusLog.Kind.GET_REQUEST : IpcBusLog.Kind.GET_MESSAGE;
                }
                else if (current_command.kind === IpcBusCommand.Kind.RequestResponse) {
                    message.kind = IpcBusLog.Kind.GET_REQUEST_RESPONSE;
                    message.responseChannel = current_command.request.replyChannel;
                    message.responseStatus = current_command.request.resolve ? 'resolved' : 'rejected';
                    }
                else if (current_command.kind === IpcBusCommand.Kind.RequestClose) {
                    message.kind = IpcBusLog.Kind.GET_CLOSE_REQUEST;
                }
                message.channel = current_command.channel;
                break;
            }
        }
        return message as IpcBusLog.Message;
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

        const trace: Partial<IpcBusLog.Trace> = {
            order: this._order,
        };

        trace.stack = [];
        let source_command = ipcBusCommand;
        const message = trace.current = trace.first = this.buildMessage(ipcBusCommand, args, payload);
        trace.stack.push(message)
        while (source_command.log.previous) {
            const previous = source_command.log.previous;
            if (previous.log == null) {
                break;
            }
            source_command = previous;
            const message = trace.first = this.buildMessage(source_command);
            trace.stack.push(message)
        }
        trace.id = `${source_command.log.id}_${trace.current.kind}`;

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



