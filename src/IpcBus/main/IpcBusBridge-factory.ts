import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../IpcBusUtils';

import { IpcBusBridge  } from './IpcBusBridge';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusBridgeJSONLogger } from './IpcBusBridgeJSONLogger';
import { IpcBusBridgeCSVLogger } from './IpcBusBridgeCSVLogger';

export const CreateIpcBusBridge: IpcBusBridge.CreateFunction = (): IpcBusBridge => {
    if (IpcBusBridgeImpl.Instance != null) {
        return IpcBusBridgeImpl.Instance;
    }
    let ipcBusBridge: IpcBusBridge = null;
    const electronProcessType = GetElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBridge process type = ${electronProcessType}`);
    switch (electronProcessType) {
        case 'main':
            const logPath = process.env['ELECTRON_IPC_BRIDGE_LOG_JSON'];
            if (logPath) {
                ipcBusBridge = new IpcBusBridgeJSONLogger(electronProcessType, logPath);
            }
            else {
                const logPath = process.env['ELECTRON_IPC_BRIDGE_LOG_CSV'];
                if (logPath) {
                    ipcBusBridge = new IpcBusBridgeCSVLogger(electronProcessType, logPath);
                }
                else {
                    ipcBusBridge = new IpcBusBridgeImpl(electronProcessType);
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