import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import { IpcBusClient } from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusClientNode } from './IpcBusClientNode';
import { IpcBusClientMain } from './IpcBusClientMain';
// import { IpcBusClientRenderer } from './IpcBusClientRenderer';

export let CreateIpcBusClient: IpcBusClient.CreateFunction = (options: any, hostname?: string): IpcBusClient => {
    let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
    let electronProcessType = GetElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`CreateIpcBusForProcess process type = ${electronProcessType} on ${JSON.stringify(options)}`);
    let ipcBusClient: IpcBusClient = null;
    switch (electronProcessType) {
        // This case 'renderer' is not reachable as IpcBusApi-browser is used in a browser (see browserify 'browser' field in package.json)
        case 'renderer':
            // ipcBusClient = new IpcBusClientRenderer(electronProcessType, localOptions || {});
            break;
        case 'main':
            if (localOptions) {
                ipcBusClient = new IpcBusClientMain(localOptions);
            }
            break;
        case 'node':
            if (localOptions) {
                ipcBusClient = new IpcBusClientNode(localOptions);
            }
            break;
    }
    return ipcBusClient;
};
