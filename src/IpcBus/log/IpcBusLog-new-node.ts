import type { IpcBusLogConfig } from './IpcBusLogConfig';
import { IpcBusLogConfigImpl } from './IpcBusLogConfigImpl';

/** @internal */
export function NewIpcBusLog(): IpcBusLogConfig {
    return new IpcBusLogConfigImpl();
};
