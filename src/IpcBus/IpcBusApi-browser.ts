
import { IpcBusClient } from './IpcBusClient';
import { IpcBusService, IpcBusServiceProxy } from './service/IpcBusService';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusServiceImpl } from './service/IpcBusServiceImpl';
import { IpcBusServiceProxyImpl } from './service/IpcBusServiceProxyImpl';


import { IpcBusClientTransportRenderer } from './IpcBusClientTransportRenderer';

export let CreateIpcBusClientRenderer: IpcBusClient.CreateFunction = (options: any, hostname?: string) => {
    let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
    let ipcBusClient: IpcBusClient = new IpcBusClientTransportRenderer('renderer', localOptions || {});
    return ipcBusClient;
};

export let CreateIpcBusService: IpcBusService.CreateFunction = (client: IpcBusClient, serviceName: string, serviceImpl: any, options?: IpcBusService.CreateOptions): IpcBusService => {
    return new IpcBusServiceImpl(client, serviceName, serviceImpl);
};

export let CreateIpcBusServiceProxy: IpcBusServiceProxy.CreateFunction = (client: IpcBusClient, serviceName: string, options?: IpcBusServiceProxy.CreateOptions): IpcBusServiceProxy => {
    return new IpcBusServiceProxyImpl(client, serviceName, options);
};

export function ActivateIpcBusTrace(enable: boolean): void {
    IpcBusUtils.Logger.enable = enable;
}

export function ActivateServiceTrace(enable: boolean): void {
    IpcBusUtils.Logger.service = enable;
}
