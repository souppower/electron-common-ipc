
import { IpcBusClient } from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusClientTransportNode } from './IpcBusClientTransportNode';
import { IpcBusClientTransportRenderer } from './IpcBusClientTransportRenderer';

import { GetElectronProcessType } from 'electron-process-type';

export let CreateIpcBusClient: IpcBusClient.CreateFunction = (options: any, hostname?: string): IpcBusClient => {
    let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
    let processType = GetElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`CreateIpcBusForProcess process type = ${processType} on ${JSON.stringify(options)}`);
    let ipcBusClient: IpcBusClient = null;
    switch (processType) {
        // This case 'renderer' is not reachable as IpcBusApi-browser is used in a browser (see browserify 'browser' field in package.json)
        case 'renderer':
            ipcBusClient = new IpcBusClientTransportRenderer(processType, localOptions || {});
            break;
        case 'browser':
        case 'node':
            if (localOptions) {
                ipcBusClient = new IpcBusClientTransportNode(processType, localOptions);
            }
            break;
    }
    return ipcBusClient;
};
