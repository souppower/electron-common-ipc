/// <reference types='electron' />

import * as path from 'path';
import * as fs from 'fs';

const csvWriter = require('csv-write-stream');

import * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { JSON_stringify } from '../IpcBusUtils';
import { IpcBusBridgeLogger } from './IpcBusBridgeLogger';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeCSVLogger extends IpcBusBridgeLogger {
    private _logger: any;
    private _line: number;

    constructor(contextType: Client.IpcBusProcessType, logPath: string) {
        super(contextType);

        this._line = 0;

        !fs.existsSync(logPath) && fs.mkdirSync(logPath);

        this._logger = csvWriter({ separator: ';', headers: [
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

    addLog(ipcBusCommand: IpcBusCommand, args: any[]): boolean {
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
                    ipcBusCommand.log.sent.id,
                    ipcBusCommand.channel,
                    ipcBusCommand.kind,
                    ipcBusCommand.log.sent.timestamp.toString(),
                    ipcBusCommand.request ? JSON.stringify(ipcBusCommand.request) : ''
                );
                if (args) {
                    for (let i = 0, l = args.length; i < l; ++i) {
                        log.push(JSON_stringify(args[i], 255));
                    }
                }
                break;
            }
            case IpcBusCommand.Kind.Log: {
                const original_command = ipcBusCommand.log.received.command;
                const local = (ipcBusCommand.peer.id === original_command.peer.id);
                const delay = (ipcBusCommand.log.sent.timestamp - original_command.log.sent.timestamp);
                if (original_command.kind === IpcBusCommand.Kind.SendMessage) {
                    log.push(
                        original_command.log.sent.id,
                        original_command.channel,
                        local ? 'GET-local' : 'GET',
                        delay.toString(),
                        original_command.request ? JSON.stringify(original_command.request) : ''
                    );
                }
                else if (original_command.kind === IpcBusCommand.Kind.RequestResponse) {
                    log.push(
                        original_command.log.sent.id,
                        original_command.request.channel,
                        local ? 'RES-local' : 'RES',
                        delay.toString(),
                        JSON.stringify(original_command.request)
                    );
                }
                if (args) {
                    for (let i = 0, l = args.length; i < l; ++i) {
                        log.push(JSON_stringify(args[i], 255));
                    }
                }
                break;
            }
        }
        this._logger.write(log);
        return (ipcBusCommand.kind !== IpcBusCommand.Kind.Log);
    }
}

