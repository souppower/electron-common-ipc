import { IpcPacketBuffer } from "socket-serializer";

import { IpcBusCommand } from "../IpcBusCommand";
import { IpcBusRendererContent } from "../renderer/IpcBusRendererContent";

import { IpcBusLog } from './IpcBusLog';
import { IpcBusLogConfigImpl } from './IpcBusLogConfigImpl';
import { IpcBusLogConfig } from './IpcBusLogConfig';
import { CreateIpcBusLog } from "./IpcBusLog-factory";
import { CutData } from "./IpcBusLogUtils";

/** @internal */
export interface IpcBusLogMain extends IpcBusLogConfig {
    getCallback(): IpcBusLog.Callback;
    setCallback(cb?: IpcBusLog.Callback): void;
    addLog(command: IpcBusCommand, args: any[], payload?: number): boolean;
    addLogRawContent(ipcBusCommand: IpcBusCommand, IpcBusRendererContent: IpcBusRendererContent): boolean;
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

    private getArgs(args?: any[]): any[] {
        if (args == null) {
            return [];
        }
        // We want full data
        if (this._argMaxContentLen <= 0) {
            return args;
        }
        else {
            const managed_args = [];
            for (let i = 0, l = args.length; i < l; ++i) {
                managed_args.push(CutData(args[i], this._argMaxContentLen));
            }
            return managed_args;
        }
    }

    private buildMessage(logMessage: IpcBusCommand.Log, args: any[], payload: number, top: boolean): IpcBusLog.Message | null {
        const command = logMessage.command;

        let needArgs = false;
        let kind: IpcBusLog.Kind;
        switch (logMessage.kind) {
            case IpcBusCommand.Kind.SendMessage:
            case IpcBusCommand.Kind.LogLocalSendRequest: {
                if (top && ((this._level & IpcBusLogConfig.Level.Sent) === 0)) {
                    return null;
                }
                kind = command.request ? IpcBusLog.Kind.SEND_REQUEST : IpcBusLog.Kind.SEND_MESSAGE;
                needArgs = (this._level & IpcBusLogConfig.Level.SentArgs) === IpcBusLogConfig.Level.SentArgs;
                break;
            }
            case IpcBusCommand.Kind.RequestClose: {
                if (top && ((this._level & IpcBusLogConfig.Level.Sent) === 0)) {
                    return null;
                }
                kind = IpcBusLog.Kind.SEND_CLOSE_REQUEST;
                break;
            }
            case IpcBusCommand.Kind.RequestResponse:
            case IpcBusCommand.Kind.LogLocalRequestResponse: {
                if (top && ((this._level & IpcBusLogConfig.Level.Sent) === 0)) {
                    return null;
                }
                kind = IpcBusLog.Kind.SEND_REQUEST_RESPONSE;
                needArgs = (this._level & IpcBusLogConfig.Level.SentArgs) === IpcBusLogConfig.Level.SentArgs;
                break;
            }
            case IpcBusCommand.Kind.LogGetMessage: {
                if (command.kind === IpcBusCommand.Kind.SendMessage) {
                    kind = command.request ? IpcBusLog.Kind.GET_REQUEST : IpcBusLog.Kind.GET_MESSAGE;
                }
                else if (command.kind === IpcBusCommand.Kind.RequestResponse) {
                    kind = IpcBusLog.Kind.GET_REQUEST_RESPONSE;
                }
                else if (command.kind === IpcBusCommand.Kind.RequestClose) {
                    kind = IpcBusLog.Kind.GET_CLOSE_REQUEST;
                }
                needArgs = (this._level & IpcBusLogConfig.Level.GetArgs) === IpcBusLogConfig.Level.GetArgs;
                break;
            }
        }

        const message: Partial<IpcBusLog.Message> = {
            kind,
            id: logMessage.id,
            peer: logMessage.peer,
            related_peer: logMessage.related_peer || logMessage.peer,
            timestamp: logMessage.timestamp - this._baseTime,
            local: logMessage.local,
            payload,
            args: needArgs ? this.getArgs(args) : undefined
        };
        switch (message.kind) {
            case IpcBusLog.Kind.SEND_MESSAGE:
            case IpcBusLog.Kind.GET_MESSAGE: {
                message.channel = command.channel;
                break;
            }
            case IpcBusLog.Kind.SEND_REQUEST:
            case IpcBusLog.Kind.GET_REQUEST: {
                message.channel = command.request.channel;
                message.responseChannel = command.request.replyChannel;
                break;
            }
            case IpcBusLog.Kind.SEND_CLOSE_REQUEST:
            case IpcBusLog.Kind.GET_CLOSE_REQUEST: {
                message.channel = command.request.channel;
                message.responseChannel = command.request.replyChannel;
                message.responseStatus = 'cancelled';
                break;
            }

            case IpcBusLog.Kind.SEND_REQUEST_RESPONSE:
            case IpcBusLog.Kind.GET_REQUEST_RESPONSE: {
                message.channel = command.request.channel;
                message.responseChannel = command.request.replyChannel;
                message.responseStatus = command.request.resolve ? 'resolved' : 'rejected';
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
            ipcBusCommand.log = {
                id,
                kind: ipcBusCommand.kind,
                timestamp: this.now,
                peer: ipcBusCommand.peer,
                command: ipcBusCommand
            };
        }

        let logMessage = ipcBusCommand.log;
        const message = this.buildMessage(logMessage, args, payload, true);
        if (message != null) {
            const trace: Partial<IpcBusLog.Trace> = {
                order: this._order,
                stack: [message]
            };
            logMessage = logMessage.previous;
            while (logMessage) {
                const message = this.buildMessage(logMessage, args, payload, false);
                trace.stack.push(message);
                logMessage = logMessage.previous;
            }
            trace.first = trace.stack[trace.stack.length - 1];
            trace.current = trace.stack[0];
            const subOrder = (trace.current.kind >= IpcBusLog.Kind.SEND_REQUEST) ? trace.current.kind - IpcBusLog.Kind.SEND_REQUEST : trace.current.kind;
            trace.id = `${trace.first.id}_${String.fromCharCode(97 + subOrder)}`;

            this._cb(trace as IpcBusLog.Trace);
        }
        return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);
    }

    addLogRawContent(ipcBusCommand: IpcBusCommand, rawContent: IpcBusRendererContent): boolean {
        if (ipcBusCommand.log) {
            const lograwContent = Object.assign({}, rawContent);
            IpcBusRendererContent.FixRawContent(lograwContent);
            IpcBusRendererContent.UnpackRawContent(lograwContent);
            this._packet.setRawContent(lograwContent);
            return this.addLog(ipcBusCommand, this._packet.parseArrayAt(1), this._packet.buffer.length);
        }
        return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);
    }

    addLogPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): boolean {
        if (ipcBusCommand.log) {
            return this.addLog(ipcBusCommand, ipcPacketBuffer.parseArrayAt(1), ipcPacketBuffer.buffer.length);
        }
        return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);
    }
}

IpcBusLog.SetLogLevel = (level: IpcBusLogConfig.Level, cb: IpcBusLog.Callback, argContentLen?: number): void => {
    const logger = CreateIpcBusLog() as IpcBusLogMain;
    logger.level = level;
    logger.setCallback(cb);
    logger.argMaxContentLen = argContentLen;
}



