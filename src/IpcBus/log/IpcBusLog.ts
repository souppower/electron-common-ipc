import { IpcBusPeer } from "../IpcBusClient";

export namespace IpcBusLog {
    export enum Level {
        None = 0,
        Sent = 1,
        Received = 2,
        Args = 4
    }

    export enum Kind {
        SEND_MESSAGE = "SEND_MESSAGE",
        GET_MESSAGE = "GET_MESSAGE",
        SEND_REQUEST = "SEND_REQUEST",
        GET_REQUEST = "GET_REQUEST",
        SEND_REQUEST_RESPONSE = "SEND_REQUEST_RESPONSE",
        GET_REQUEST_RESPONSE = "GET_REQUEST_RESPONSE",
    }

    export interface Trace {
        order: number;
        channel: string;
        id: string;
        peer_source: IpcBusPeer;
        timestamp_source: number;
        peer: IpcBusPeer;
        timestamp: number;

        kind: Kind;

        local?: boolean;
        args?: any[];
    }

    export interface Callback {
        (trace: Trace): void;
    }

    export let GetLogLevel: () => IpcBusLog.Level;
    export let SetLogLevel: (level: IpcBusLog.Level, cb?: IpcBusLog.Callback) => void;
    export let SetLogLevelJSON: (level: IpcBusLog.Level, filename: string) => void;
    export let SetLogLevelCVS: (level: IpcBusLog.Level, filename: string) => void;
}
