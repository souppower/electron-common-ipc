
import { IpcBusClient } from '../IpcBusClient';

import { IpcBusService, IpcBusServiceProxy } from './IpcBusService';
import { IpcBusServiceImpl } from './IpcBusServiceImpl';
import { IpcBusServiceProxyImpl } from './IpcBusServiceProxyImpl';

export let CreateIpcBusService: IpcBusService.CreateFunction = (client: IpcBusClient, serviceName: string, serviceImpl: any, options?: IpcBusService.CreateOptions): IpcBusService => {
    return new IpcBusServiceImpl(client, serviceName, serviceImpl);
};

IpcBusService.Create = CreateIpcBusService;

export let CreateIpcBusServiceProxy: IpcBusServiceProxy.CreateFunction = (client: IpcBusClient, serviceName: string, options?: IpcBusServiceProxy.CreateOptions): IpcBusServiceProxy => {
    return new IpcBusServiceProxyImpl(client, serviceName, options);
};

IpcBusServiceProxy.Create = CreateIpcBusServiceProxy;
