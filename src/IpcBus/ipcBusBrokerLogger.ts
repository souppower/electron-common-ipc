import * as path from 'path';
import * as fs from 'fs';

import * as winston from 'winston';

import { IpcPacketNet } from 'socket-serializer';
import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from './IpcBusUtils';
import { IpcBusCommand } from './IpcBusCommand';


/** @internal */
export class IpcBusBrokerLogger {
    private _baseIpc: IpcPacketNet;
    private _logger: winston.LoggerInstance;

    constructor(pathLog: string) {
        !fs.existsSync(pathLog) && fs.mkdirSync(pathLog);

        this._logger = new (winston.Logger)({
            transports: [
                new (winston.transports.File)({
                    filename: path.join(pathLog, 'electron-common-ipcbus-broker.log')
                })
            ]
        });
    }

    start(baseIpc: IpcPacketNet): void {
        this._baseIpc = baseIpc;

        this._baseIpc.on('connection', (socket: any, server: any) => this._onConnection(socket, server));
        this._baseIpc.on('close', (err: any, socket: any, server: any) => this._onClose(err, socket, server));
        this._baseIpc.on('packet', (buffer: any, socket: any, server: any) => this._onData(buffer, socket, server));
    }

    stop() {
    }

    private _onConnection(socket: any, server: any): void {
        // this._logger.info(`Socket remotePort=${socket.remotePort} : Incoming`);
        // socket.on('error', (err: string) => {
        //     this._logger.error(`Socket remotePort=${socket.remotePort} : Error ${err}`);
        // });
    }

    private _onClose(err: any, socket: any, server: any): void {
    }

    private _onData(packet: IpcPacketBuffer, socket: any, server: any): void {
        let ipcBusCommand: IpcBusCommand = packet.parseArrayAt(0);
        let log: any = { packetSize: packet.packetSize, command: ipcBusCommand};
        for (let i = 1, l = packet.parseArrayLength(); i < l; ++i) {
            log[`arg${i - 1}`] = packet.parseArrayAt(i);
        }
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.Connect: {
                log[socket] = socket.remotePort;
                this._logger.info(`Connect`, log);
                break;
            }
            case IpcBusCommand.Kind.Disconnect: {
                log[socket] = socket.remotePort;
                this._logger.info(`Disconnect`, log);
                break;
            }
            case IpcBusCommand.Kind.Close: {
                log[socket] = socket.remotePort;
                this._logger.info(`Close`, log);
                break;
            }
            case IpcBusCommand.Kind.AddChannelListener: {
                this._logger.info(`AddChannelListener`, log);
                break;
            }
            case IpcBusCommand.Kind.RemoveChannelAllListeners: {
                this._logger.info(`RemoveChannelAllListeners`, log);
                break;
            }
            case IpcBusCommand.Kind.RemoveChannelListener: {
                this._logger.info(`RemoveListeners`, log);
                break;
            }
            case IpcBusCommand.Kind.RemoveListeners: {
                this._logger.info(`RemoveAll`, log);
                break;
            }
            case IpcBusCommand.Kind.SendMessage: {
                this._logger.info(`SendMessage`, log);
                break;
            }
            case IpcBusCommand.Kind.RequestMessage: {
                this._logger.info(`RequestMessage`, log);
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                this._logger.info(`RequestResponse`, log);
                break;
            }
            case IpcBusCommand.Kind.RequestCancel: {
                this._logger.info(`RequestCancel`, log);
                break;
            }
        }
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(log);
    }
}
