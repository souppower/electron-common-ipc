import * as net from 'net';

import * as path from 'path';
import * as fs from 'fs';

import * as winston from 'winston';

import { IpcPacketBuffer } from 'socket-serializer';

import * as Client from '../IpcBusClient';

import { IpcBusCommand } from '../IpcBusCommand';

import { IpcBusBrokerLogger } from './IpcBusBrokerLogger';

/** @internal */
export class IpcBusBrokerJSONLogger extends IpcBusBrokerLogger {
    private _logger: winston.LoggerInstance;

    constructor(logPath: string, contextType: Client.IpcBusProcessType) {
        super(contextType);

        !fs.existsSync(logPath) && fs.mkdirSync(logPath);

        this._logger = new (winston.Logger)({
            transports: [
                new (winston.transports.File)({
                    filename: path.join(logPath, 'electron-common-ipcbus-broker.log')
                })
            ]
        });
    }

    protected addLog(socket: net.Socket, packet: IpcPacketBuffer, ipcBusCommand: IpcBusCommand, args: any[]): void {
        const log: any = { packetSize: packet.packetSize, command: ipcBusCommand};
        if (args) {
            for (let i = 0, l = args.length; i < l; ++i) {
                log[`arg${i}`] = args[i];
            }
        }
        log['socket'] = socket.remotePort ? socket.remotePort : '';
        this._logger.info(ipcBusCommand.kind, log);
    }
}
