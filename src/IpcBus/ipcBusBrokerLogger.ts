//import { Buffer } from 'buffer';

import { IpcPacketNet } from 'socket-serializer';
// import * as util from 'util';

import { IpcBusCommand } from './IpcBusTransport';
import { IpcPacketBuffer } from 'socket-serializer';

import * as winston from 'winston';

/** @internal */
export class IpcBusBrokerLogger {
    private _baseIpc: IpcPacketNet;
    private _logger: winston.LoggerInstance;

    constructor(path: string) {
        this._logger = new (winston.Logger)({
            transports: [
                new (winston.transports.File)({
                  filename: path,
                  datePattern: `.yyyyMMdd.log`
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
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.Connect: {
                this._logger.info(`Connect`, { command: ipcBusCommand, socket: socket.remotePort });
                break;
            }
            case IpcBusCommand.Kind.Disconnect: {
                this._logger.info(`Disconnect`, { command: ipcBusCommand, socket: socket.remotePort });
                break;
            }
            case IpcBusCommand.Kind.Close: {
                this._logger.info(`Close`, { command: ipcBusCommand, socket: socket.remotePort });
                break;
            }
            case IpcBusCommand.Kind.SubscribeChannel: {
                this._logger.info(`AddListener`, { command: ipcBusCommand });
                break;
            }
            case IpcBusCommand.Kind.UnsubscribeChannel: {
                if (ipcBusCommand.data && ipcBusCommand.data.unsubscribeAll) {
                    this._logger.info(`RemoveAllListeners`, { command: ipcBusCommand });
                }
                else {
                    this._logger.info(`RemoveListeners`, { command: ipcBusCommand });
                }
                break;
            }
            case IpcBusCommand.Kind.UnsubscribeAllChannels: {
                this._logger.info(`RemoveAllListeners`, { command: ipcBusCommand });
                break;
            }
            case IpcBusCommand.Kind.SendMessage: {
                let arg: any = packet.parseArrayAt(1);
                this._logger.info(`SendMessage`, { command: ipcBusCommand, arg });
                break;
            }
            case IpcBusCommand.Kind.RequestMessage: {
                let arg: any = packet.parseArrayAt(1);
                this._logger.info(`RequestMessage`, { command: ipcBusCommand, arg });
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                this._logger.info(`RequestResponse`, { command: ipcBusCommand });
                break;
            }
            case IpcBusCommand.Kind.RequestCancel: {
                this._logger.info(`RequestCancel`, { command: ipcBusCommand });
                break;
            }
        }
    }
}
