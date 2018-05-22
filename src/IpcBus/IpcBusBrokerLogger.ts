import * as path from 'path';
import * as fs from 'fs';

import * as winston from 'winston';

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusCommand } from './IpcBusCommand';

import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';

/** @internal */
export class IpcBusBrokerLogger extends IpcBusBrokerImpl {
    private _logger: winston.LoggerInstance;

    constructor(logPath: string, processType: IpcBusInterfaces.IpcBusProcessType, ipcOptions: IpcBusUtils.IpcOptions) {
        super(processType, ipcOptions);

        !fs.existsSync(logPath) && fs.mkdirSync(logPath);

        this._logger = new (winston.Logger)({
            transports: [
                new (winston.transports.File)({
                    filename: path.join(logPath, 'electron-common-ipcbus-broker.log')
                })
            ]
        });
    }

    protected _onServerData(packet: IpcPacketBuffer, socket: any, server: any): void {
        let ipcBusCommand: IpcBusCommand = packet.parseArrayAt(0);
        let log: any = { packetSize: packet.packetSize, command: ipcBusCommand};
        for (let i = 1, l = packet.parseArrayLength(); i < l; ++i) {
            log[`arg${i - 1}`] = packet.parseArrayAt(i);
        }
        log[socket] = socket.remotePort;
        this._logger.info(ipcBusCommand.kind, log);
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(log);

        super._onServerData(packet, socket, server);
    }
}
