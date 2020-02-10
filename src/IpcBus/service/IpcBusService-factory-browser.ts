import { CreateIpcBusService, CreateIpcBusServiceProxy } from './IpcBusService-factory';

const windowLocal = window as any;
windowLocal.CreateIpcBusService = CreateIpcBusService;
windowLocal.CreateIpcBusServiceProxy = CreateIpcBusServiceProxy;
