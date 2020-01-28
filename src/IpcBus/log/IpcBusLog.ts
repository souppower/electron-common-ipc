import { IpcPacketBuffer } from "socket-serializer";

import { IpcBusCommand } from "../IpcBusCommand";

export namespace IpcBusLog {

    export enum Level {
        None = 0,
        Sent = 1,
        Received = 2,
        Args = 4
    }

    export interface Callback {
        (command: IpcBusCommand, args: any[]): void;
    }
}

export interface IpcBusLog {
    getCallback(): IpcBusLog.Callback;
    getLogLevel(): number;
    setLogLevel(logLevel: IpcBusLog.Level, cb?: IpcBusLog.Callback): void;
    addLog(command: IpcBusCommand, args: any[]): boolean;
    addLogRawContent(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): boolean;
    addLogPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): boolean;
}
