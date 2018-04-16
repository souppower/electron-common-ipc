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

    constructor(processType: IpcBusInterfaces.IpcBusProcessType, ipcOptions: IpcBusUtils.IpcOptions) {
        super(processType, ipcOptions);

        let pathLog = process.env['ELECTRON_IPC_BUS_LOGPATH'];
        !fs.existsSync(pathLog) && fs.mkdirSync(pathLog);

        this._logger = new (winston.Logger)({
            transports: [
                new (winston.transports.File)({
                    filename: path.join(pathLog, 'electron-common-ipcbus-broker.log')
                })
            ]
        });
    }

    protected _onData(packet: IpcPacketBuffer, socket: any, server: any): void {
        let ipcBusCommand: IpcBusCommand = packet.parseArrayAt(0);
        let log: any = { packetSize: packet.packetSize, command: ipcBusCommand};
        for (let i = 1, l = packet.parseArrayLength(); i < l; ++i) {
            log[`arg${i - 1}`] = packet.parseArrayAt(i);
        }
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.Connect:
                log[socket] = socket.remotePort;
                this._logger.info(`Connect`, log);
                break;

            case IpcBusCommand.Kind.Disconnect:
                log[socket] = socket.remotePort;
                this._logger.info(`Disconnect`, log);
                break;

            case IpcBusCommand.Kind.Close:
                log[socket] = socket.remotePort;
                this._logger.info(`Close`, log);
                break;

            case IpcBusCommand.Kind.AddChannelListener:
                this._logger.info(`AddChannelListener`, log);
                break;

            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                this._logger.info(`RemoveChannelAllListeners`, log);
                break;

            case IpcBusCommand.Kind.RemoveChannelListener:
                this._logger.info(`RemoveListeners`, log);
                break;

            case IpcBusCommand.Kind.RemoveListeners:
                this._logger.info(`RemoveAll`, log);
                break;

            case IpcBusCommand.Kind.SendMessage:
                this._logger.info(`SendMessage`, log);
                break;

            case IpcBusCommand.Kind.RequestMessage:
                this._logger.info(`RequestMessage`, log);
                break;

            case IpcBusCommand.Kind.RequestResponse:
                this._logger.info(`RequestResponse`, log);
                break;

            case IpcBusCommand.Kind.RequestCancel:
                this._logger.info(`RequestCancel`, log);
                break;

            default:
                this._logger.error(`Wrong ipcBusCommand`, log);
                break;
        }
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(log);

        super._onData(packet, socket, server);
    }
}
