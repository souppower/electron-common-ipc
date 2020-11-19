import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../IpcBusUtils';

import type { IpcBusLogConfig } from './IpcBusLogConfig';

let g_log: IpcBusLogConfig;

/** @internal */
export const CreateIpcBusLog = (): IpcBusLogConfig => {
    if (g_log == null) {
        const electronProcessType = GetElectronProcessType();
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`CreateIpcBusLog process type = ${electronProcessType}`);
        switch (electronProcessType) {
            case 'main': {
                const newModule = require('./IpcBusLog-new-main');
                g_log = newModule.NewIpcBusLog();
                break;
            }
            // This case 'renderer' is not reachable as 'factory-browser' is used in a browser (see browserify 'browser' field in package.json)
            case 'renderer':
            case 'node':
            default: {
                const newModule = require('./IpcBusLog-new-node');
                g_log = newModule.NewIpcBusLog();
                break;
            }
        }
    }
    return g_log;
};
