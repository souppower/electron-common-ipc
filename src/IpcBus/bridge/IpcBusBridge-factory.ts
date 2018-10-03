import { GetElectronProcessType } from 'electron-process-type';

import { IpcBusProcessType } from '../IpcBusClient';
import * as IpcBusUtils from '../IpcBusUtils';

import { IpcBusBridge  } from './IpcBusBridge';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusBridgeJSONLogger } from './IpcBusBridgeJSONLogger';
import { IpcBusBridgeCSVLogger } from './IpcBusBridgeCSVLogger';

export let CreateIpcBusBridge: IpcBusBridge.CreateFunction = (options: any, hostname?: string): IpcBusBridge => {
    let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
    if (!localOptions) {
        return null;
    }

    let ipcBusBridge: IpcBusBridge = null;
    let processType = GetElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBridge process type = ${processType} on ${JSON.stringify(options)}`);
    switch (processType) {
        case 'browser':
            let logPath = process.env['ELECTRON_IPC_BRIDGE_LOG_JSON'];
            if (logPath) {
                ipcBusBridge = new IpcBusBridgeJSONLogger(logPath, processType as IpcBusProcessType, localOptions);
            }
            else {
                let logPath = process.env['ELECTRON_IPC_BRIDGE_LOG_CSV'];
                if (logPath) {
                    ipcBusBridge = new IpcBusBridgeCSVLogger(logPath, processType as IpcBusProcessType, localOptions);
                }
                else {
                    ipcBusBridge = new IpcBusBridgeImpl(processType as IpcBusProcessType, localOptions);
                }
            }
            break;
        // not supported process
        case 'renderer':
        case 'node':
        default:
            break;
    }
    return ipcBusBridge;
};
