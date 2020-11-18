import { IpcBusLogConfigMain } from './IpcBusLogConfigMain';
import type { IpcBusLogConfig } from './IpcBusLogConfig';

/** @internal */
export function NewIpcBusLog(): IpcBusLogConfig {
    return new IpcBusLogConfigMain();
};
