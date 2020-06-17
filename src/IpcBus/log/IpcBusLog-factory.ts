import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../IpcBusUtils';

import { IpcBusLogConfigMain } from './IpcBusLogConfigMain';
import { IpcBusLogConfig } from './IpcBusLogConfig';
import { IpcBusLogConfigImpl } from './IpcBusLogConfigImpl';

let g_log: IpcBusLogConfig;

/** @internal */
export const CreateIpcBusLog = (): IpcBusLogConfig => {
    if (g_log == null) {
        const electronProcessType = GetElectronProcessType();
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`CreateIpcBusLog process type = ${electronProcessType}`);
        switch (electronProcessType) {
            case 'main':
                g_log = new IpcBusLogConfigMain();
                break;
            case 'renderer':
            case 'node':
            default:
                g_log = new IpcBusLogConfigImpl();
                break;
        }
    }
    return g_log;
};
