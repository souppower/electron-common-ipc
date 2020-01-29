import * as path from 'path';
import * as fs from 'fs';

const csvWriter = require('csv-write-stream');

import { IpcBusCommand } from '../IpcBusCommand';
import { JSON_stringify } from './IpcBusLogUtils';
import { IpcBusLog } from './IpcBusLog';
import { SetLogLevel } from './IpcBusLogImpl';

/** @internal */
export class CSVLogger {
    private _logger: any;
    private _line: number;

    constructor(logPath: string) {
        this._line = 0;

        !fs.existsSync(logPath) && fs.mkdirSync(logPath);

        this._logger = csvWriter({ separator: '\t', headers: [
            '#',
            'peer id',
            'peer',
            'message id',
            'message channel',
            'message kind',
            'message timestamp',
            'request',
            'arg0',
            'arg1',
            'arg2',
            'arg3',
            'arg4',
            'arg5'
        ]});
        this._logger.pipe(fs.createWriteStream(path.join(logPath, 'electron-common-ipcbus-bridge.csv.txt')));
    }

    addLog(ipcBusCommand: IpcBusCommand, args: any[]): void {
        if (ipcBusCommand.log) {
            const peer = ipcBusCommand.peer;
            ++this._line;
            const log: string[] = [
                this._line.toString(),
                peer.id,
                JSON.stringify(peer)
            ];

            let remainingArgs = 6;
            if ((args != null) && args.length) {
                remainingArgs -= args.length;
            }

            switch (ipcBusCommand.kind) {
                case IpcBusCommand.Kind.SendMessage: {
                    const current_command = ipcBusCommand;
                    log.push(
                        current_command.log ? current_command.log.id : '?',
                        current_command.channel,
                        current_command.request ? 'SEND-REQUEST' : 'SEND-MESSAGE',
                        '',
                        current_command.request ? JSON.stringify(current_command.request) : ''
                    );
                    if (args && args.length) {
                        for (let i = 0, l = args.length; i < l; ++i) {
                            log.push(JSON_stringify(args[i], 255));
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
                    let delay = '?';
                    if (original_command) {
                        delay = ((ipcBusCommand.log.timestamp - original_command.log.timestamp)).toString();
                    }
                    log.push(
                        ipcBusCommand.log ? ipcBusCommand.log.id : '?',
                        ipcBusCommand.channel,
                        local ? 'REQUEST-RESPONSE-local' : 'SEND-REQUEST-RESPONSE',
                        delay,
                        JSON.stringify(ipcBusCommand.request)
                    );
                    if (args && args.length) {
                        for (let i = 0, l = args.length; i < l; ++i) {
                            log.push(JSON_stringify(args[i], 255));
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
                    if (current_command.kind === IpcBusCommand.Kind.SendMessage) {
                        log.push(
                            current_command.log.id,
                            current_command.channel,
                            current_command.request ? local ? 'REQUEST-local' : 'GET-REQUEST' : local ? 'MESSAGE-local' : 'GET-MESSAGE',
                            delay.toString(),
                            current_command.request ? JSON.stringify(current_command.request) : ''
                        );
                    }
                    else if (current_command.kind === IpcBusCommand.Kind.RequestResponse) {
                        log.push(
                            current_command.log.id,
                            current_command.request.channel,
                            'GET-REQUEST-RESPONSE',
                            delay.toString(),
                            JSON.stringify(current_command.request)
                        );
                    }
                    break;
                }
            }
            for (let i = 0, l = remainingArgs; i < l; ++i) {
                log.push('');
            }
            this._logger.write(log);
        }
    }
}

let cvsLogger: CSVLogger;
export function SetLogLevelCVS(level: IpcBusLog.Level, filename: string): void {
    if (level >= IpcBusLog.Level.None) {
        if (cvsLogger == null) {
            cvsLogger = new CSVLogger(filename);
            const cb = cvsLogger.addLog.bind(cvsLogger);
            SetLogLevel(level, cb);
        }
    }
    else {
        cvsLogger = null;
    }
}