import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../IpcBusUtils';

import { IpcBusBridge } from './IpcBusBridge';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusBridgeLogger } from './IpcBusBridgeLogger';

import { IpcBusLog } from '../log/IpcBusLog';
import { ipcBusLog } from '../log/IpcBusLogImpl';
import { IpcBusLogConfig } from '../log/IpcBusLogConfig';

let g_bridge: IpcBusBridge;
export const CreateIpcBusBridge: IpcBusBridge.CreateFunction = (): IpcBusBridge => {
    if (g_bridge == null) {
        const electronProcessType = GetElectronProcessType();
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBridge process type = ${electronProcessType}`);
        switch (electronProcessType) {
            case 'main':
                // For backward
                if (process.env['ELECTRON_IPC_LOG'] && process.env['ELECTRON_IPC_LOG_CSV']) {
                    IpcBusLog.SetLogLevelCVS(Number(process.env['ELECTRON_IPC_LOG']), process.env['ELECTRON_IPC_LOG_CSV']);
                }
                if (process.env['ELECTRON_IPC_LOG'] && process.env['ELECTRON_IPC_LOG_JSON']) {
                    IpcBusLog.SetLogLevelJSON(Number(process.env['ELECTRON_IPC_LOG']), process.env['ELECTRON_IPC_LOG_JSON']);
                }
                if (ipcBusLog.level > IpcBusLogConfig.Level.None) {
                    g_bridge = new IpcBusBridgeLogger(electronProcessType, ipcBusLog);
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