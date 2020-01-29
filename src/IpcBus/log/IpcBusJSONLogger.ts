import * as path from 'path';
import * as fs from 'fs';

import * as winston from 'winston';

import * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { JSON_stringify } from './IpcBusLogUtils';
import { IpcBusLog } from './IpcBusLog';
import { SetLogLevel } from './IpcBusLogImpl';

interface JSONLog {
    line: number,
    peer_id: string,
    peer: Client.IpcBusPeer,
    message_id?: string,
    message_channel?: string,
    message_kind?: string,
    message_timestamp?: number,
    request?: IpcBusCommand.Request,
    arg0?: string,
    arg1?: string,
    arg2?: string,
    arg3?: string,
    arg4?: string,
    arg5?: string,
}

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class JSONLogger {
    private _logger: winston.LoggerInstance;
    private _line: number;

    constructor(logPath: string) {
        this._line = 0;

        !fs.existsSync(logPath) && fs.mkdirSync(logPath);

        this._logger = new (winston.Logger)({
            transports: [
                new (winston.transports.File)({
                    filename: path.join(logPath, 'electron-common-ipcbus-bridge.log')
                })
            ]
        });
    }

    addLog(ipcBusCommand: IpcBusCommand, args: any[]): void {

        if (ipcBusCommand.log) {
            const peer = ipcBusCommand.peer;
            ++this._line;
            const log: JSONLog = {
                line: this._line,
                peer_id: peer.id,
                peer
            };

            switch (ipcBusCommand.kind) {
                case IpcBusCommand.Kind.SendMessage: {
                    const current_command = ipcBusCommand;
                    log.message_id = current_command.log ? current_command.log.id : '?';
                    log.message_channel = current_command.channel;
                    log.message_kind = current_command.request ? 'SEND-REQUEST' : 'SEND-MESSAGE';
                    log.request = current_command.request;
                    if (args && args.length) {
                        for (let i = 0, l = args.length; i < l; ++i) {
                            (log as any)[`arg${i}`] = JSON_stringify(args[i], 255);
                        }
                    }
                    break;
                }
                case IpcBusCommand.Kind.RequestResponse:
                case IpcBusCommand.Kind.LogRequestResponse: {
                    const current_command = ipcBusCommand;
                    let original_command = current_command;
                    while (original_command.log.previous) {
                        original_command = original_command.log.previous;
                    }
                    const local = ipcBusCommand.log.local;
                    let delay: number;
                    if (original_command) {
                        delay = (ipcBusCommand.log.timestamp - original_command.log.timestamp);
                    }
                    log.message_id = current_command.log ? current_command.log.id : '?';
                    log.message_channel = current_command.channel;
                    log.message_kind = local ? 'REQUEST-RESPONSE-local' : 'SEND-REQUEST-RESPONSE';
                    log.message_timestamp = delay;
                    log.request = current_command.request;
                    if (args && args.length) {
                        for (let i = 0, l = args.length; i < l; ++i) {
                            (log as any)[`arg${i}`] = JSON_stringify(args[i], 255);
                        }
                    }
                    break;
                }
                case IpcBusCommand.Kind.LogGetMessage: {
                    const current_command = ipcBusCommand.log.previous;
                    let original_command = current_command;
                    while (original_command?.log?.previous) {
                        original_command = original_command.log.previous;
                    }
                    const local = ipcBusCommand.log.local;
                    const delay = (ipcBusCommand.log.timestamp - original_command.log.timestamp);
                    log.message_id = current_command.log ? current_command.log.id : '?';
                    log.message_channel = current_command.channel;
                    if (current_command.kind === IpcBusCommand.Kind.SendMessage) {
                        log.message_kind = current_command.request ? local ? 'REQUEST-local' : 'GET-REQUEST' : local ? 'MESSAGE-local' : 'GET-MESSAGE';
                    }
                    else if (current_command.kind === IpcBusCommand.Kind.RequestResponse) {
                        log.message_kind = 'GET-REQUEST-RESPONSE';
                    }
                    log.message_timestamp = delay;
                    log.request = current_command.request;
                    break;
                }
            }
            this._logger.info(this._line.toString(), log);
        }
    }
}

let jsonLogger: JSONLogger;
export function SetLogLevelJSON(level: IpcBusLog.Level, filename: string): void {
    if (level >= IpcBusLog.Level.None) {
        if (jsonLogger == null) {
            jsonLogger = new JSONLogger(filename);
            const cb = jsonLogger.addLog.bind(jsonLogger);
            SetLogLevel(level, cb);
        }
    }
    else {
        jsonLogger = null;
    }
}
