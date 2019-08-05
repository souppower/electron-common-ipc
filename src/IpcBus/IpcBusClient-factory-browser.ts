
import { IpcBusClient } from './IpcBusClient';
// import * as IpcBusUtils from './IpcBusUtils';

// import { IpcBusClientRenderer } from './IpcBusClientRenderer';

export const CreateIpcBusClient: IpcBusClient.CreateFunction = (options: any, hostname?: string) => {
    const windowLocal = window as any;
    if (windowLocal.ElectronCommonIpc && windowLocal.ElectronCommonIpc.CreateIpcBusClient) {
        return windowLocal.ElectronCommonIpc.CreateIpcBusClient(options, hostname);
    }
    return null;

    // try {
    //     const electron = require('electron');
    //     let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
    //     let ipcBusClient: IpcBusClient = new IpcBusClientRenderer('renderer', localOptions || {}, electron.ipcRenderer);
    //     return ipcBusClient;
    // }
    // catch (_) {
    // }
};

IpcBusClient.Create = CreateIpcBusClient;
