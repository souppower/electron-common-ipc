import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../IpcBusUtils';

import { IpcBusBridge } from './IpcBusBridge';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusBridgeJSONLogger } from './IpcBusBridgeJSONLogger';
import { IpcBusBridgeCSVLogger } from './IpcBusBridgeCSVLogger';

let g_bridge: IpcBusBridge;
export const CreateIpcBusBridge: IpcBusBridge.CreateFunction = (): IpcBusBridge => {
    if (g_bridge == null) {
        const electronProcessType = GetElectronProcessType();
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBridge process type = ${electronProcessType}`);
        switch (electronProcessType) {
            case 'main':
                const logPath = process.env['ELECTRON_IPC_BRIDGE_LOG_JSON'];
                if (logPath) {
                    g_bridge = new IpcBusBridgeJSONLogger(electronProcessType, logPath);
                }
                else {
                    const logPath = process.env['ELECTRON_IPC_BRIDGE_LOG_CSV'];
                    if (logPath) {
                        g_bridge = new IpcBusBridgeCSVLogger(electronProcessType, logPath);
                    }
                    else {
                        g_bridge = new IpcBusBridgeImpl(electronProcessType);
                    }
                }
                break;
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