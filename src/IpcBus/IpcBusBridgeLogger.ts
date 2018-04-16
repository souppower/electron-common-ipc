import * as path from 'path';
import * as fs from 'fs';

import * as winston from 'winston';

import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusCommand } from './IpcBusCommand';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeLogger  {
    private _ipcMain: any;
    private _onRendererMessageBind: Function;
    private _logger: winston.LoggerInstance;

    constructor(pathLog: string) {
        this._onRendererMessageBind = this._onRendererMessage.bind(this);

        !fs.existsSync(pathLog) && fs.mkdirSync(pathLog);

        this._logger = new (winston.Logger)({
            transports: [
                new (winston.transports.File)({
                    filename: path.join(pathLog, 'electron-common-ipcbus-bridge.log')
                })
            ]
        });
    }

    // IpcBusBridge API
    start(ipcMain: any): void {
        this._ipcMain = ipcMain;
        this._ipcMain.addListener(IpcBusUtils.IPC_BUS_RENDERER_COMMAND, this._onRendererMessageBind);
    }

    stop() {
        this._ipcMain.removeListener(IpcBusUtils.IPC_BUS_RENDERER_COMMAND, this._onRendererMessageBind);
    }

    private _onRendererMessage(event: any, ipcBusCommand: IpcBusCommand, args: any[]) {
        let log: any = { command: ipcBusCommand};
        if (args) {
            for (let i = 0, l = args.length; i < l; ++i) {
                log[`arg${i}`] = args[i];
            }
        }

        const webContents = event.sender;
        log.webContents = { id: webContents.id, url: webContents.getURL() };

        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.Connect : {
                this._logger.info(`Connect`, log);
                break;
            }
            case IpcBusCommand.Kind.Disconnect :
                this._logger.info(`Disconnect`, log);
                break;
            case IpcBusCommand.Kind.Close :
                // We do not close the socket, we just disconnect a peer
                this._logger.info(`Close`, log);
                break;
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
            default :
                break;
        }
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(log);
    }
}

