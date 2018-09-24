
import * as Client from './IpcBusClientInterfaces';
import * as IpcBusServiceInterfaces from './service/IpcBusServiceInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusServiceImpl } from './service/IpcBusServiceImpl';
import { IpcBusServiceProxyImpl } from './service/IpcBusServiceProxyImpl';


import { IpcBusClientTransportRenderer } from './IpcBusClientTransportRenderer';

export let CreateIpcBusClientRenderer: Client.IpcBusClient.CreateFunction = (options: any, hostname?: string) => {
    let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
    let ipcBusClient: Client.IpcBusClient = new IpcBusClientTransportRenderer('renderer', localOptions || {});
    return ipcBusClient;
};

export let CreateIpcBusService: IpcBusServiceInterfaces.IpcBusService.CreateFunction = (client: Client.IpcBusClient, serviceName: string, serviceImpl: any, options?: IpcBusServiceInterfaces.IpcBusService.CreateOptions): IpcBusServiceInterfaces.IpcBusService => {
    return new IpcBusServiceImpl(client, serviceName, serviceImpl);
};

export let CreateIpcBusServiceProxy: IpcBusServiceInterfaces.IpcBusServiceProxy.CreateFunction = (client: Client.IpcBusClient, serviceName: string, options?: IpcBusServiceInterfaces.IpcBusServiceProxy.CreateOptions): IpcBusServiceInterfaces.IpcBusServiceProxy => {
    return new IpcBusServiceProxyImpl(client, serviceName, options);
};

export function ActivateIpcBusTrace(enable: boolean): void {
    IpcBusUtils.Logger.enable = enable;
}

export function ActivateServiceTrace(enable: boolean): void {
    IpcBusUtils.Logger.service = enable;
}
