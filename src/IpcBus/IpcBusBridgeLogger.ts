/// <reference types='electron' />

import * as path from 'path';
import * as fs from 'fs';

import * as winston from 'winston';

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeLogger extends IpcBusBridgeImpl {
    private _logger: winston.LoggerInstance;

    constructor(logPath: string, processType: IpcBusInterfaces.IpcBusProcessType, options: IpcBusInterfaces.IpcBusBridge.CreateOptions) {
        super(processType, options);

        !fs.existsSync(logPath) && fs.mkdirSync(logPath);

        this._logger = new (winston.Logger)({
            transports: [
                new (winston.transports.File)({
                    filename: path.join(logPath, 'electron-common-ipcbus-bridge.log')
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

    protected _onEventReceived(ipcPacketBuffer: IpcPacketBuffer) {
        let args = ipcPacketBuffer.parseArray();
        let ipcBusCommand: IpcBusCommand = args.shift();
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage:
            case IpcBusCommand.Kind.RequestMessage: {
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
                    const webContents = connData.conn;
                    let log = this.createLog(webContents, ipcBusCommand, args);
                    this._logger.info(ipcBusCommand.kind, log);
                });
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                const webContents = this._requestChannels.get(ipcBusCommand.request.replyChannel);
                if (webContents) {
                    let log = this.createLog(webContents, ipcBusCommand, args);
                    this._logger.info(ipcBusCommand.kind, log);
                }
                break;
            }
        }

        super._onEventReceived(ipcPacketBuffer);
    }

    protected _onRendererMessage(event: any, ipcBusCommand: IpcBusCommand, buffer: Buffer) {
        this._packetBuffer.decodeFromBuffer(buffer);
        let args = this._packetBuffer.parseArraySlice(1);
        let log = this.createLog(event.sender, ipcBusCommand, args);
        this._logger.info(ipcBusCommand.kind, log);
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(log);

        super._onRendererMessage(event, ipcBusCommand, buffer);
    }
}

