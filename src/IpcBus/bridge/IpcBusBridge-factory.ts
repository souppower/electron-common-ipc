import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../IpcBusUtils';

import { IpcBusBridge  } from './IpcBusBridge';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusBridgeJSONLogger } from './IpcBusBridgeJSONLogger';
import { IpcBusBridgeCSVLogger } from './IpcBusBridgeCSVLogger';

export const CreateIpcBusBridge: IpcBusBridge.CreateFunction = (options: any, hostname?: string): IpcBusBridge => {
    const localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
    if (!localOptions) {
        return null;
    }

    let ipcBusBridge: IpcBusBridge = null;
    const electronProcessType = GetElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBridge process type = ${electronProcessType} on ${JSON.stringify(options)}`);
    switch (electronProcessType) {
        case 'main':
            const logPath = process.env['ELECTRON_IPC_BRIDGE_LOG_JSON'];
            if (logPath) {
                ipcBusBridge = new IpcBusBridgeJSONLogger(logPath, localOptions);
            }
            else {
                const logPath = process.env['ELECTRON_IPC_BRIDGE_LOG_CSV'];
                if (logPath) {
                    ipcBusBridge = new IpcBusBridgeCSVLogger(logPath, localOptions);
                }
                else {
                    ipcBusBridge = new IpcBusBridgeImpl(localOptions);
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

IpcBusBridge.Create = CreateIpcBusBridge;