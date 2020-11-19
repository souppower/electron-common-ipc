import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../IpcBusUtils';

import { IpcBusBridge } from './IpcBusBridge';

let g_bridge: IpcBusBridge;
export const CreateIpcBusBridge: IpcBusBridge.CreateFunction = (): IpcBusBridge => {
    if (g_bridge == null) {
        const electronProcessType = GetElectronProcessType();
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`CreateIpcBusBridge process type = ${electronProcessType}`);
        switch (electronProcessType) {
            case 'main': {
                const newModule = require('./IpcBusBridge-new-main');
                g_bridge = newModule.NewIpcBusBridge(electronProcessType);
                break;
            }
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