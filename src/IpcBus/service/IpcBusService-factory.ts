
import { IpcBusClient } from '../IpcBusClient';

import { IpcBusService, IpcBusServiceProxy } from './IpcBusService';
import { IpcBusServiceImpl } from './IpcBusServiceImpl';
import { IpcBusServiceProxyImpl } from './IpcBusServiceProxyImpl';

export const CreateIpcBusService: IpcBusService.CreateFunction = (client: IpcBusClient, serviceName: string, serviceImpl: any, options?: IpcBusService.CreateOptions): IpcBusService => {
    return new IpcBusServiceImpl(client, serviceName, serviceImpl);
};

IpcBusService.Create = CreateIpcBusService;

export const CreateIpcBusServiceProxy: IpcBusServiceProxy.CreateFunction = <T>(client: IpcBusClient, serviceName: string, options?: IpcBusServiceProxy.CreateOptions): IpcBusServiceProxy<T> => {
    return new IpcBusServiceProxyImpl<T>(client, serviceName, options);
};

IpcBusServiceProxy.Create = CreateIpcBusServiceProxy;
