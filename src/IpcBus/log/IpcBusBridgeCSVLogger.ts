import * as path from 'path';
import * as fs from 'fs';

const csvWriter = require('csv-write-stream');

import { IpcBusCommand } from '../IpcBusCommand';
import { JSON_stringify } from '../IpcBusUtils';
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

            switch (ipcBusCommand.kind) {
                case IpcBusCommand.Kind.SendMessage: {
                    log.push(
                        ipcBusCommand.log.post.id,
                        ipcBusCommand.channel,
                        'SEND-MESSAGE',
                        '', // ipcBusCommand.log.post.timestamp.toString(),
                        ipcBusCommand.request ? JSON.stringify(ipcBusCommand.request) : ''
                    );
                    break;
                }
                case IpcBusCommand.Kind.RequestResponse: {
                    log.push(
                        ipcBusCommand.log.post.id,
                        ipcBusCommand.channel,
                        'SEND-RESPONSE',
                        '', // ipcBusCommand.log.post.timestamp.toString(),
                        JSON.stringify(ipcBusCommand.request)
                    );
                    break;
                }
                case IpcBusCommand.Kind.LogGet: {
                    const original_command = ipcBusCommand.log.received.command;
                    const local = ipcBusCommand.log.received.local;
                    const delay = (ipcBusCommand.log.post.timestamp - original_command.log.post.timestamp);
                    if (original_command.kind === IpcBusCommand.Kind.SendMessage) {
                        log.push(
                            original_command.log.post.id,
                            original_command.channel,
                            local ? 'MESSAGE-local' : 'GET-MESSAGE',
                            delay.toString(),
                            original_command.request ? JSON.stringify(original_command.request) : ''
                        );
                    }
                    else if (original_command.kind === IpcBusCommand.Kind.RequestResponse) {
                        log.push(
                            original_command.log.post.id,
                            original_command.request.channel,
                            local ? 'RESPONSE-local' : 'GET-RESPONSE',
                            delay.toString(),
                            JSON.stringify(original_command.request)
                        );
                    }
                    break;
                }
                case IpcBusCommand.Kind.LogSend: {
                    const original_command = ipcBusCommand.log.received.command;
                    log.push(
                        original_command.log.post.id,
                        original_command.channel,
                        'SEND-local',
                        '', // ipcBusCommand.log.post.timestamp.toString(),
                        original_command.request ? JSON.stringify(original_command.request) : ''
                    );
                    break;
                }
            }
            if (args) {
                for (let i = 0, l = args.length; i < l; ++i) {
                    log.push(JSON_stringify(args[i], 255));
                }
            }
            this._logger.write(log);
        }
    }
}

let cvsLogger: CSVLogger;
export function SetLogLevelCVS(level: IpcBusLog.Level, filename: string): void {
    cvsLogger = new CSVLogger(filename);
    const cb = cvsLogger.addLog.bind(cvsLogger);
    SetLogLevel(level, cb);
}
