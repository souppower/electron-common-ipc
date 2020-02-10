export * from './IpcBus/IpcBusClient';

export * from './IpcBus/service/IpcBusService';
export * from './IpcBus/service/IpcBusService-factory';

export * from './IpcBus/log/IpcBusLog';

export * from './IpcBus/renderer/IpcBusRendererPreload';

import * as IpcBusUtils from './IpcBus/IpcBusUtils';

export function ActivateIpcBusTrace(enable: boolean): void {
    IpcBusUtils.Logger.enable = enable;
}

export function ActivateServiceTrace(enable: boolean): void {
    IpcBusUtils.Logger.service = enable;
}

// Force to execute code
/** @internal */
import './IpcBus/service/IpcBusService-factory';