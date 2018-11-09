
import { IpcBusClient } from './IpcBusClient';
// import * as IpcBusUtils from './IpcBusUtils';

// import { IpcBusClientTransportRenderer } from './IpcBusClientTransportRenderer';

export let CreateIpcBusClient: IpcBusClient.CreateFunction = (options: any, hostname?: string) => {
    const windowLocal = window as any;
    if (windowLocal.CreateIpcBusClient) {
        return windowLocal.CreateIpcBusClient(options, hostname);
    }
    return null;

    // try {
    //     const electron = require('electron');
    //     let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
    //     let ipcBusClient: IpcBusClient = new IpcBusClientTransportRenderer('renderer', localOptions || {}, electron.ipcRenderer);
    //     return ipcBusClient;
    // }
    // catch (_) {
    // }
};
