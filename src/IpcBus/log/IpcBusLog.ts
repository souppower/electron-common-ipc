import { IpcBusPeer } from '../IpcBusClient';
import { IpcBusLogConfig } from './IpcBusLogConfig';

export namespace IpcBusLog {
    export enum Kind {
        SEND_MESSAGE,
        GET_MESSAGE,
        SEND_REQUEST,
        GET_REQUEST,
        SEND_REQUEST_RESPONSE,
        GET_REQUEST_RESPONSE,
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

    export function KindToStr(kind: Kind): string {
        switch (kind) {
            case Kind.SEND_MESSAGE:
                return 'SendMessage';
            case Kind.GET_MESSAGE:
                return 'GetMessage';
            case Kind.SEND_REQUEST:
                return 'SendRequest';
            case Kind.GET_REQUEST:
                return 'GetRequest';
            case Kind.SEND_REQUEST_RESPONSE:
                return 'SendRequestResponse';
            case Kind.GET_REQUEST_RESPONSE:
                return 'GetRequestResponse';
        }

    }

    export interface Callback {
        (trace: Trace): void;
    }

    export let SetLogLevel: (level: IpcBusLogConfig.Level, cb?: IpcBusLog.Callback) => void;
    export let SetLogLevelJSON: (level: IpcBusLogConfig.Level, filename: string) => void;
    export let SetLogLevelCVS: (level: IpcBusLogConfig.Level, filename: string) => void;
}
