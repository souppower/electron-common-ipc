import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import { IpcBusClient } from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusClientTransportNode } from './IpcBusClientTransportNode';
// import { IpcBusClientTransportRenderer } from './IpcBusClientTransportRenderer';

export let CreateIpcBusClient: IpcBusClient.CreateFunction = (options: any, hostname?: string): IpcBusClient => {
    let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
    let electronProcessType = GetElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`CreateIpcBusForProcess process type = ${electronProcessType} on ${JSON.stringify(options)}`);
    let ipcBusClient: IpcBusClient = null;
    switch (electronProcessType) {
        // This case 'renderer' is not reachable as IpcBusApi-browser is used in a browser (see browserify 'browser' field in package.json)
        case 'renderer':
            // ipcBusClient = new IpcBusClientTransportRenderer(electronProcessType, localOptions || {});
            break;
        case 'main':
        case 'node':
            if (localOptions) {
                ipcBusClient = new IpcBusClientTransportNode(electronProcessType, localOptions);
            }
            break;
    }
    return ipcBusClient;
};
