import * as net from 'net';

import * as path from 'path';
import * as fs from 'fs';

const csvWriter = require('csv-write-stream');

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusCommand } from './IpcBusCommand';

import { IpcBusBrokerLogger } from './IpcBusBrokerLogger';

/** @internal */
export class IpcBusBrokerCSVLogger extends IpcBusBrokerLogger {
    private _logger: any;
    private _line: number;

    constructor(logPath: string, processType: IpcBusInterfaces.IpcBusProcessType, options: IpcBusInterfaces.IpcBusBroker.CreateOptions) {
        super(processType, options);

        this._line = 0;

        !fs.existsSync(logPath) && fs.mkdirSync(logPath);

        this._logger = csvWriter({ separator: ';', headers: ['#', 'kind', 'size', 'peer id', 'peer process', 'socket', 'arg0', 'arg1', 'arg2', 'arg3', 'arg4', 'arg5' ]});
        this._logger.pipe(fs.createWriteStream(path.join(logPath, 'electron-common-ipcbus-broker.csv')));
    }

    protected addLog(socket: net.Socket, packet: IpcPacketBuffer, ipcBusCommand: IpcBusCommand, args: any[]): void {
        ++this._line;
        let log: string[] = [ this._line.toString(), ipcBusCommand.kind, packet.packetSize.toString(), ipcBusCommand.peer.id, JSON.stringify(ipcBusCommand.peer.process), socket.remotePort.toString() ];
        if (args) {
            for (let i = 0, l = args.length; i < l; ++i) {
                log.push(JSON.stringify(args[i]));
            }
        }
        this._logger.write(log);
    }
}
