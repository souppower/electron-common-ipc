
import { IpcBusClient } from '../IpcBusClient';

import { IpcBusService } from './IpcBusService';
import { IpcBusServiceImpl } from './IpcBusServiceImpl';

export const CreateIpcBusService: IpcBusService.CreateFunction = (client: IpcBusClient, serviceName: string, serviceImpl: any, options?: IpcBusService.CreateOptions): IpcBusService => {
    return new IpcBusServiceImpl(client, serviceName, serviceImpl);
};

const windowLocal = window as any;
windowLocal.CreateIpcBusService = CreateIpcBusService

IpcBusService.Create = CreateIpcBusService;
