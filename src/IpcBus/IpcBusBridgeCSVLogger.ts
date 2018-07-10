import * as path from 'path';
import * as fs from 'fs';

const csvWriter = require('csv-write-stream');

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusBridgeLogger } from './IpcBusBridgeLogger';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeCSVLogger extends IpcBusBridgeLogger {
    private _logger: any;

    constructor(logPath: string, processType: IpcBusInterfaces.IpcBusProcessType, options: IpcBusInterfaces.IpcBusBridge.CreateOptions) {
        super(processType, options);

        !fs.existsSync(logPath) && fs.mkdirSync(logPath);

        this._logger = csvWriter({ separator: ';', headers: ['kind', 'size', 'peer id', 'peer process', 'arg0', 'arg1', 'arg2', 'arg3', 'arg4', 'arg5' ]});
        this._logger.pipe(fs.createWriteStream(path.join(logPath, 'electron-common-ipcbus-bridge.csv')));
    }

    protected addLog(webContents: Electron.WebContents, ipcPacketBuffer: IpcPacketBuffer, ipcBusCommand: IpcBusCommand, args: any[]): any {
        let log: string[] = [ ipcBusCommand.kind, ipcPacketBuffer.packetSize.toString(), JSON.stringify(ipcBusCommand.peer.process), JSON.stringify(ipcBusCommand.peer) ];
        if (args) {
            for (let i = 0, l = args.length; i < l; ++i) {
                log.push(args[i]);
            }
        }
        this._logger.write(log);
    }
}

