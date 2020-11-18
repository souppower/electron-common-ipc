import type { IpcBusPeer } from '../IpcBusClient';
import type { IpcBusLogConfig } from './IpcBusLogConfig';

export namespace IpcBusLog {
    export enum Kind {
        SEND_MESSAGE,
        GET_MESSAGE,
        SEND_REQUEST,
        GET_REQUEST,
        SEND_REQUEST_RESPONSE,
        GET_REQUEST_RESPONSE,
        SEND_CLOSE_REQUEST,
        GET_CLOSE_REQUEST,
    }

    export interface Message {
        id: string;
        peer: IpcBusPeer;
        related_peer: IpcBusPeer;
        timestamp: number;
        channel: string;
        kind: Kind;
        responseChannel?: string;
        responseStatus?: 'resolved' | 'rejected' | 'cancelled';
        local?: boolean;
        payload?: number;
        args?: any[];
    }

    export interface Trace {
        order: number;
        id: string;

        first: Message;
        current: Message;
        stack: Message[];
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
            case Kind.SEND_CLOSE_REQUEST:
                return 'SendCloseRequest';
            case Kind.GET_CLOSE_REQUEST:
                return 'GetCloseRequest';
            }
    }

    export interface Callback {
        (trace: Trace): void;
    }

    export let SetLogLevel: (level: IpcBusLogConfig.Level, cb: IpcBusLog.Callback, argContentLen?: number) => void;
    export let SetLogLevelJSON: (level: IpcBusLogConfig.Level, filename: string, argContentLen?: number) => void;
    export let SetLogLevelCVS: (level: IpcBusLogConfig.Level, filename: string, argContentLen?: number) => void;
}
