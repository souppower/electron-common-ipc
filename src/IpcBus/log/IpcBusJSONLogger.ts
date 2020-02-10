import * as path from 'path';
import * as fse from 'fs-extra';
import * as winston from 'winston';

import * as Client from '../IpcBusClient';
// import { JSON_stringify } from './IpcBusLogUtils';
import { IpcBusLog } from './IpcBusLog';
import { IpcBusLogConfig } from './IpcBusLogConfig';

/** @internal */
export interface JSONLog {
    order: number,
    timestamp: number;
    channel?: string,
    id: string,
    kind: string,
    peer_id: string,
    peer: Client.IpcBusPeer,
    peer_related?: Client.IpcBusPeer,
    delay?: number,
    local?: boolean,
    payload?: number,
    responseChannel?: string;
    responseStatus?: string;
    arg0?: string,
    arg1?: string,
    arg2?: string,
    arg3?: string,
    arg4?: string,
    arg5?: string,
}

/** @internal */
export class JSONLoggerBase {
    constructor() {
    }

    addLog(trace: IpcBusLog.Trace): void {
        const jsonLog: JSONLog = {
            order: trace.order,
            timestamp: trace.current.timestamp,
            channel: trace.first.channel,
            id: trace.id,
            kind: IpcBusLog.KindToStr(trace.current.kind),
            peer: trace.current.peer,
            peer_id: trace.first.peer.id,
        };

        switch (trace.current.kind) {
            case IpcBusLog.Kind.SEND_MESSAGE:
            case IpcBusLog.Kind.SEND_REQUEST: {
                break;
            }
            case IpcBusLog.Kind.SEND_CLOSE_REQUEST: {
                break;
            }
            case IpcBusLog.Kind.SEND_REQUEST_RESPONSE: {
                const delay = trace.current.timestamp - trace.first.timestamp;
                jsonLog.delay = delay;
                break;
            }
            case IpcBusLog.Kind.GET_CLOSE_REQUEST:
            case IpcBusLog.Kind.GET_MESSAGE:
            case IpcBusLog.Kind.GET_REQUEST:
            case IpcBusLog.Kind.GET_REQUEST_RESPONSE:
                const delay = trace.current.timestamp - trace.first.timestamp;
                jsonLog.delay = delay;
                break;
        }
        jsonLog.local = trace.current.local;
        if (trace.current.related_peer.id != trace.current.peer.id) {
            jsonLog.peer_related = trace.current.related_peer;
        }
        jsonLog.responseChannel = trace.current.responseChannel;
        jsonLog.responseStatus = trace.current.responseStatus;
        jsonLog.payload = trace.current.payload;

        const args = trace.current.args;
        if (args) {
            for (let i = 0, l = args.length; i < l; ++i) {
                (jsonLog as any)[`arg${i}`] = args[i];
            }
        }
        this.writeLog(jsonLog);
    }

    writeLog(jsonLog: JSONLog): void {
    }
}

/** @internal */
export class JSONLogger extends JSONLoggerBase {
    private _winstonLogger: winston.LoggerInstance;

    constructor(logPath: string) {
        super();

        const filename = path.join(logPath, 'electron-common-ipcbus-bridge.json');
        fse.ensureDirSync(logPath);
        try {
            fse.unlinkSync(filename);
        }
        catch (_) {}

        this._winstonLogger = new (winston.Logger)({
            transports: [
                new (winston.transports.File)({
                    filename
                })
            ]
        });
    }

    writeLog(jsonLog: JSONLog): void {
        this._winstonLogger.info(jsonLog.order.toString(), jsonLog);
    }
}

let jsonLogger: JSONLogger;
IpcBusLog.SetLogLevelJSON = (level: IpcBusLogConfig.Level, filename: string, argContentLen?: number): void => {
    if (level >= IpcBusLogConfig.Level.None) {
        if (jsonLogger == null) {
            jsonLogger = new JSONLogger(filename);
            const cb = jsonLogger.addLog.bind(jsonLogger);
            IpcBusLog.SetLogLevel(level, cb, argContentLen);
        }
    }
    else {
        jsonLogger = null;
    }
}
