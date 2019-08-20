export * from './IpcBus/IpcBusClient';
export * from './IpcBus/service/IpcBusService';
export * from './IpcBus/service/IpcBusService-factory';

export * from './IpcBus/IpcBusRendererPreload';

import * as IpcBusUtils from './IpcBus/IpcBusUtils';

export function ActivateIpcBusTrace(enable: boolean): void {
    IpcBusUtils.Logger.enable = enable;
}

export function ActivateServiceTrace(enable: boolean): void {
    IpcBusUtils.Logger.service = enable;
}

