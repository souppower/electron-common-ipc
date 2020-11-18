import * as path from 'path';

import type { ElectronProcessType } from 'electron-process-type/lib/v2';

import type { IpcBusBridge } from './IpcBusBridge';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusBridgeLogger } from './IpcBusBridgeLogger';

import { IpcBusLog } from '../log/IpcBusLog';
import { IpcBusLogConfig } from '../log/IpcBusLogConfig';
import { CreateIpcBusLog } from '../log/IpcBusLog-factory';
import type { IpcBusLogMain } from '../log/IpcBusLogConfigMain';

/** @internal */
export function NewIpcBusBridge(electronProcessType: ElectronProcessType): IpcBusBridge {
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
    let bridge: IpcBusBridge;
    if (logger.level > IpcBusLogConfig.Level.None) {
        bridge = new IpcBusBridgeLogger(electronProcessType, logger);
    }
    else {
        bridge = new IpcBusBridgeImpl(electronProcessType);
    }
    return bridge;
};