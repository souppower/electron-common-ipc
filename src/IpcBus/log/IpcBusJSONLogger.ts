import * as path from 'path';
import * as fs from 'fs';

import * as winston from 'winston';

import * as Client from '../IpcBusClient';
import { JSON_stringify } from './IpcBusLogUtils';
import { IpcBusLog } from './IpcBusLog';
import { IpcBusLogConfig } from './IpcBusLogConfig';

/** @internal */
interface JSONLog {
    order: number,
    id: string,
    peer_id: string,
    peer: Client.IpcBusPeer,
    peer_source?: Client.IpcBusPeer,
    channel?: string,
    kind?: string,
    delay?: number,
    arg0?: string,
    arg1?: string,
    arg2?: string,
    arg3?: string,
    arg4?: string,
    arg5?: string,
}

/** @internal */
export class JSONLogger {
    private _logger: winston.LoggerInstance;

    constructor(logPath: string) {
        !fs.existsSync(logPath) && fs.mkdirSync(logPath);

        this._logger = new (winston.Logger)({
            transports: [
                new (winston.transports.File)({
                    filename: path.join(logPath, 'electron-common-ipcbus-bridge.log')
                })
            ]
        });
    }

    addLog(trace: IpcBusLog.Trace): void {
        const peer = trace.peer;
        const log: JSONLog = {
            order: trace.order,
            channel: trace.channel,
            id: trace.id,
            kind: IpcBusLog.KindToStr(trace.kind),

            peer_id: peer.id,
            peer,
        };

        if (trace.peer != trace.peer_source) {
            log.peer_source = trace.peer_source;
        }

        switch (trace.kind) {
            case IpcBusLog.Kind.SEND_MESSAGE:
            case IpcBusLog.Kind.SEND_REQUEST: {
                if (trace.args && trace.args.length) {
                    for (let i = 0, l = trace.args.length; i < l; ++i) {
                        (log as any)[`arg${i}`] = JSON_stringify(trace.args[i], 255);
                    }
                }
                break;
            }
            case IpcBusLog.Kind.SEND_REQUEST_RESPONSE: {
                log.delay = trace.timestamp - trace.timestamp_source;
                if (trace.local) {
                    log.kind += '-local';
                }
                if (trace.args && trace.args.length) {
                    for (let i = 0, l = trace.args.length; i < l; ++i) {
                        (log as any)[`arg${i}`] = JSON_stringify(trace.args[i], 255);
                    }
                }
                break;
            }
            case IpcBusLog.Kind.GET_MESSAGE:
            case IpcBusLog.Kind.GET_REQUEST:
            case IpcBusLog.Kind.GET_REQUEST_RESPONSE:
                log.delay = trace.timestamp - trace.timestamp_source;
                if (trace.local) {
                    log.kind += '-local';
                }
                break;
        }
        this._logger.info(log.order.toString(), log);
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
