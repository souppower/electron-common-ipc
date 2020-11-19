import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../IpcBusUtils';

import { IpcBusBroker } from './IpcBusBroker';

export const CreateIpcBusBroker: IpcBusBroker.CreateFunction = (): IpcBusBroker | null => {
    let ipcBusBroker: IpcBusBroker = null;
    const electronProcessType = GetElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBroker process type = ${electronProcessType}`);
    switch (electronProcessType) {
        case 'main': {
            const newModule = require('./IpcBusBroker-new-main');
            ipcBusBroker = newModule.NewIpcBusBroker(electronProcessType);
            break;
        }
        case 'node': {
            const newModule = require('./IpcBusBroker-new-node');
            ipcBusBroker = newModule.NewIpcBusBroker(electronProcessType);
            break;
        }
        // not supported process
        case 'renderer':
        default:
            break;
    }
    return ipcBusBroker;
};

IpcBusBroker.Create = CreateIpcBusBroker;