import * as path from 'path';

import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../IpcBusUtils';

import { IpcBusBridge } from './IpcBusBridge';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusBridgeLogger } from './IpcBusBridgeLogger';

import { IpcBusLog } from '../log/IpcBusLog';
import { IpcBusLogConfig } from '../log/IpcBusLogConfig';
import { CreateIpcBusLog } from '../log/IpcBusLog-factory';
import { IpcBusLogMain } from '../log/IpcBusLogConfigMain';

let g_bridge: IpcBusBridge;
export const CreateIpcBusBridge: IpcBusBridge.CreateFunction = (): IpcBusBridge => {
    if (g_bridge == null) {
        const electronProcessType = GetElectronProcessType();
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBridge process type = ${electronProcessType}`);
        switch (electronProcessType) {
            case 'main': {
                const logger = CreateIpcBusLog() as IpcBusLogMain;
                // For backward
                if (process.env['ELECTRON_IPC_LOG_CSV']) {
                    if (logger.level === IpcBusLogConfig.Level.None) {
                        logger.level = IpcBusLogConfig.Level.SentArgs;
                    }
                    // if (logger.argMaxContentLen < 0) {
                    //     logger.argMaxContentLen = 255;
                    // }
                    const filename = path.join(process.env['ELECTRON_IPC_LOG_CSV'], 'electron-common-ipc.csv');
                    IpcBusLog.SetLogLevelCVS(logger.level, filename, logger.argMaxContentLen);
                }
                // For backward
                if (process.env['ELECTRON_IPC_LOG_JSON']) {
                    if (logger.level === IpcBusLogConfig.Level.None) {
                        logger.level = IpcBusLogConfig.Level.SentArgs;
                    }
                    // if (logger.argMaxContentLen < 0) {
                    //     logger.argMaxContentLen = 255;
                    // }
                    const filename = path.join(process.env['ELECTRON_IPC_LOG_JSON'], 'electron-common-ipc.json');
                    IpcBusLog.SetLogLevelJSON(logger.level, filename, logger.argMaxContentLen);
                }
                if (logger.level > IpcBusLogConfig.Level.None) {
                    g_bridge = new IpcBusBridgeLogger(electronProcessType, logger);
                }
                else {
                    g_bridge = new IpcBusBridgeImpl(electronProcessType);
                }
                break;
            }
            // not supported process
            case 'renderer':
            case 'node':
            default:
                break;
        }
    }
    return g_bridge;
};

IpcBusBridge.Create = CreateIpcBusBridge;