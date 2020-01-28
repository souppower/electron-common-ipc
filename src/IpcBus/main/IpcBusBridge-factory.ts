import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../IpcBusUtils';

import { IpcBusBridge } from './IpcBusBridge';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusBridgeLogger } from './IpcBusBridgeLogger';

import { IpcBusLog } from '../log/IpcBusLog';
import { logManager } from '../log/IpcBusLogImpl';

let g_bridge: IpcBusBridge;
export const CreateIpcBusBridge: IpcBusBridge.CreateFunction = (): IpcBusBridge => {
    if (g_bridge == null) {
        const electronProcessType = GetElectronProcessType();
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBridge process type = ${electronProcessType}`);
        switch (electronProcessType) {
            case 'main':
                if (logManager.getLogLevel() > IpcBusLog.Level.None) {
                    g_bridge = new IpcBusBridgeLogger(electronProcessType, logManager);
                }
                else {
                    g_bridge = new IpcBusBridgeImpl(electronProcessType);
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