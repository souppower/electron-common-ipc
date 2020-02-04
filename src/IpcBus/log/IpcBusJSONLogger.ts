import * as path from 'path';
import * as fs from 'fs';

import * as winston from 'winston';

import * as Client from '../IpcBusClient';
import { JSON_stringify } from './IpcBusLogUtils';
import { IpcBusLog } from './IpcBusLog';
import { IpcBusLogConfig } from './IpcBusLogConfig';

/** @internal */
export interface JSONLog {
    order: number,
    channel?: string,
    id: string,
    kind?: string,
    peer_id: string,
    peer: Client.IpcBusPeer,
    peer_source?: Client.IpcBusPeer,
    delay?: number,
    local?: boolean,
    payload?: number,
    request?: string;
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
        const peer = trace.peer;
        const jsonLog: JSONLog = {
            order: trace.order,
            channel: trace.channel,
            id: trace.id,
            kind: IpcBusLog.KindToStr(trace.kind),

            peer_id: peer.id,
            peer,
            payload: trace.payload
        };

        if (trace.peer != trace.peer_source) {
            jsonLog.peer_source = trace.peer_source;
        }

        if (jsonLog.request) {
            jsonLog.request = JSON.stringify(trace.request);
        }
        jsonLog.local = trace.local;

        switch (trace.kind) {
            case IpcBusLog.Kind.SEND_MESSAGE:
            case IpcBusLog.Kind.SEND_REQUEST: {
                if (trace.args && trace.args.length) {
                    for (let i = 0, l = trace.args.length; i < l; ++i) {
                        (jsonLog as any)[`arg${i}`] = JSON_stringify(trace.args[i], 255);
                    }
                }
                break;
            }
            case IpcBusLog.Kind.SEND_CLOSE_REQUEST: {
                break;
            }
            case IpcBusLog.Kind.SEND_REQUEST_RESPONSE: {
                jsonLog.delay = trace.timestamp - trace.timestamp_source;
                if (trace.local) {
                    jsonLog.kind += '-local';
                }
                if (trace.args && trace.args.length) {
                    for (let i = 0, l = trace.args.length; i < l; ++i) {
                        (jsonLog as any)[`arg${i}`] = JSON_stringify(trace.args[i], 255);
                    }
                }
                break;
            }
            case IpcBusLog.Kind.GET_MESSAGE:
            case IpcBusLog.Kind.GET_REQUEST:
            case IpcBusLog.Kind.GET_REQUEST_RESPONSE:
            case IpcBusLog.Kind.GET_CLOSE_REQUEST:
                jsonLog.delay = trace.timestamp - trace.timestamp_source;
                if (trace.local) {
                    jsonLog.kind += '-local';
                }
                break;
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

        !fs.existsSync(logPath) && fs.mkdirSync(logPath);

        this._winstonLogger = new (winston.Logger)({
            transports: [
                new (winston.transports.File)({
                    filename: path.join(logPath, 'electron-common-ipcbus-bridge.log')
                })
            ]
        });
    }

    writeLog(jsonLog: JSONLog): void {
        this._winstonLogger.info(jsonLog.order.toString(), jsonLog);
    }
}

let jsonLogger: JSONLogger;
IpcBusLog.SetLogLevelJSON = (level: IpcBusLogConfig.Level, filename: string): void => {
    if (level >= IpcBusLogConfig.Level.None) {
        if (jsonLogger == null) {
            jsonLogger = new JSONLogger(filename);
            const cb = jsonLogger.addLog.bind(jsonLogger);
            IpcBusLog.SetLogLevel(level, cb);
        }
    }
    else {
        jsonLogger = null;
    }
}
