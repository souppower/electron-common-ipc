import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import { IpcBusClient } from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';

export const CreateIpcBusClient: IpcBusClient.CreateFunction = (): IpcBusClient => {
    const electronProcessType = GetElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`CreateIpcBusForProcess process type = ${electronProcessType}`);
    let ipcBusClient: IpcBusClient = null;
    switch (electronProcessType) {
        // This case 'renderer' is not reachable as 'factory-browser' is used in a browser (see browserify 'browser' field in package.json)
        case 'renderer':
            break;
        case 'main': {
            const newModule = require('./IpcBusClient-new-main');
            ipcBusClient = newModule.NewIpcBusClient(electronProcessType);
            break;
        }
        case 'node': {
            const newModule = require('./IpcBusClient-new-node');
            ipcBusClient = newModule.NewIpcBusClient(electronProcessType);
            break;
        }
    }
    return ipcBusClient;
};

IpcBusClient.Create = CreateIpcBusClient;
