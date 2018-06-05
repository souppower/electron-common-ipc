
// import * as IpcBusInterfaces from './IpcBusInterfaces';
import { IpcBusClient } from './IpcBusInterfaces';
// import { IpcBusRequestResponse } from './IpcBusInterfaces';
// export * from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusServiceImpl } from './IpcBusServiceImpl';
import { IpcBusService } from './IpcBusInterfaces';
import { IpcBusServiceProxyImpl } from './IpcBusServiceProxyImpl';
import { IpcBusServiceProxy } from './IpcBusInterfaces';

import { IpcBusClientTransportRenderer } from './IpcBusClientTransportRenderer';

/** @internal */
export function _CreateIpcBusClientRenderer(busPath?: string): IpcBusClient | null {
    let ipcOptions = IpcBusUtils.ExtractIpcOptions(busPath);
    if (!ipcOptions.isValid()) {
        return null;
    }
    let ipcBusClient: IpcBusClient = new IpcBusClientTransportRenderer('renderer', ipcOptions);
    return ipcBusClient;
}

/** @internal */
export function _CreateIpcBusService(client: IpcBusClient, serviceName: string, serviceImpl: any = undefined): IpcBusService {
    return new IpcBusServiceImpl(client, serviceName, serviceImpl);
}

/** @internal */
export function _CreateIpcBusServiceProxy(client: IpcBusClient, serviceName: string, callTimeout?: number): IpcBusServiceProxy {
    return new IpcBusServiceProxyImpl(client, serviceName, callTimeout);
}
/** @internal */
export function _ActivateIpcBusTrace(enable: boolean): void {
    IpcBusUtils.Logger.enable = enable;
}

/** @internal */
export function _ActivateServiceTrace(enable: boolean): void {
    IpcBusUtils.Logger.service = enable;
}
