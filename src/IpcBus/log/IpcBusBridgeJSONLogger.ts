// /// <reference types='electron' />

// import * as path from 'path';
// import * as fs from 'fs';

// import * as winston from 'winston';

// import * as Client from '../IpcBusClient';
// import { IpcBusCommand } from '../IpcBusCommand';
// import { IpcBusBridgeLogger } from '../main/IpcBusBridgeLogger';

// // This class ensures the transfer of data between Broker and Renderer/s using ipcMain
// /** @internal */
// export class IpcBusBridgeJSONLogger extends IpcBusBridgeLogger {
//     private _logger: winston.LoggerInstance;

//     constructor(contextType: Client.IpcBusProcessType, logPath: string) {
//         super(contextType);

//         !fs.existsSync(logPath) && fs.mkdirSync(logPath);

//         this._logger = new (winston.Logger)({
//             transports: [
//                 new (winston.transports.File)({
//                     filename: path.join(logPath, 'electron-common-ipcbus-bridge.log')
//                 })
//             ]
//         });
//     }

//     addLog(ipcBusCommand: IpcBusCommand, args: any[]): boolean {
//         const log: any = { command: ipcBusCommand };
//         if (args) {
//             for (let i = 0, l = args.length; i < l; ++i) {
//                 log[`arg${i}`] = args[i];
//             }
//         }
//         log.peer = ipcBusCommand.peer;
//         this._logger.info(ipcBusCommand.kind, log);
//         return (ipcBusCommand.kind.lastIndexOf('LOG', 0) !== 0);

//     }
// }

// export function SetLogLevelJSON(level: LogLevel, filename: string): void {
//     // return logLevelManager.setLogLevel(level, cb);
// }