import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../IpcBusUtils';

import { IpcBusLogMainImpl } from './IpcBusLogImpl';
import { IpcBusLogConfig } from './IpcBusLogConfig';
import { IpcBusLogConfigImpl } from './IpcBusLogConfigImpl';

let g_log: IpcBusLogConfig;
export const CreateIpcBusLog = (): IpcBusLogConfig => {
    if (g_log == null) {
        const electronProcessType = GetElectronProcessType();
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBridge process type = ${electronProcessType}`);
        switch (electronProcessType) {
            case 'main':
                g_log = new IpcBusLogMainImpl();
                break;
            // not supported process
            case 'renderer':
            case 'node':
            default:
                g_log = new IpcBusLogConfigImpl();
                break;
        }
    }
    return g_log;
};
