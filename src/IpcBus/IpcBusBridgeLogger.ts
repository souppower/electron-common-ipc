import * as path from 'path';
import * as fs from 'fs';

import * as winston from 'winston';

import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { WSAENAMETOOLONG } from 'constants';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeLogger extends IpcBusBridgeImpl {
    private _logger: winston.LoggerInstance;

    constructor(processType: IpcBusInterfaces.IpcBusProcessType, ipcOptions: IpcBusUtils.IpcOptions) {
        super(processType, ipcOptions);

        let pathLog = process.env['ELECTRON_IPC_BUS_LOGPATH'];

        !fs.existsSync(pathLog) && fs.mkdirSync(pathLog);

        this._logger = new (winston.Logger)({
            transports: [
                new (winston.transports.File)({
                    filename: path.join(pathLog, 'electron-common-ipcbus-bridge.log')
                })
            ]
        });
    }

    createLog(webContents: Electron.WebContents, ipcBusCommand: IpcBusCommand, args: any[]): any {
        let log: any = { command: ipcBusCommand };
        if (args) {
            for (let i = 0, l = args.length; i < l; ++i) {
                log[`arg${i}`] = args[i];
            }
        }
        log.webContents = { id: webContents.id, url: webContents.getURL(), isLoadingMainFrame: webContents.isLoadingMainFrame() };
        try {
            log.webContents.rid = (webContents as any).getProcessId();
        }
        catch (err) {
        }
        try {
            log.webContents.pid = webContents.getOSProcessId();
        }
        catch (err) {
        }
        return log;
    }

    protected _onEventReceived(ipcBusCommand: IpcBusCommand, args: any[]) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage:
            case IpcBusCommand.Kind.RequestMessage: {
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
                    const webContents = connData.conn;
                    let log = this.createLog(webContents, ipcBusCommand, args);
                    this._logger.info(`Receive Message`, log);
                });
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                const webContents = this._requestChannels.get(ipcBusCommand.data.replyChannel);
                if (webContents) {
                    let log = this.createLog(webContents, ipcBusCommand, args);
                    this._logger.info(`Receive Request`, log);
                }
                break;
            }
        }
        super._onEventReceived(ipcBusCommand, args);
    }

    protected _onRendererMessage(event: any, ipcBusCommand: IpcBusCommand, args: any[]) {
        let log = this.createLog(event.sender, ipcBusCommand, args);

        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.Connect :
                this._logger.info(`Connect`, log);
                break;

            case IpcBusCommand.Kind.Disconnect :
                this._logger.info(`Disconnect`, log);
                break;

            case IpcBusCommand.Kind.Close :
                // We do not close the socket, we just disconnect a peer
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

            default :
                break;
        }
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(log);
        super._onRendererMessage(event, ipcBusCommand, args);
    }
}

