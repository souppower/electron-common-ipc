import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import { IpcBusContextType } from '../IpcBusClient';
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
    let electronProcessType = GetElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBridge process type = ${electronProcessType} on ${JSON.stringify(options)}`);
    switch (electronProcessType) {
        case 'main':
            let logPath = process.env['ELECTRON_IPC_BRIDGE_LOG_JSON'];
            if (logPath) {
                ipcBusBridge = new IpcBusBridgeJSONLogger(logPath, electronProcessType as IpcBusContextType, localOptions);
            }
            else {
                let logPath = process.env['ELECTRON_IPC_BRIDGE_LOG_CSV'];
                if (logPath) {
                    ipcBusBridge = new IpcBusBridgeCSVLogger(logPath, electronProcessType as IpcBusContextType, localOptions);
                }
                else {
                    ipcBusBridge = new IpcBusBridgeImpl(electronProcessType as IpcBusContextType, localOptions);
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
