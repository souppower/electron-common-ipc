
import { IpcBusClient } from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusClientTransportRenderer } from './IpcBusClientTransportRenderer';

export let CreateIpcBusClient: IpcBusClient.CreateFunction = (options: any, hostname?: string) => {
    let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
    let ipcBusClient: IpcBusClient = new IpcBusClientTransportRenderer('renderer', localOptions || {});
    return ipcBusClient;
};
