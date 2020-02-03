import { IpcBusLogConfig } from './IpcBusLogConfig';
import { IpcBusLogConfigImpl } from './IpcBusLogConfigImpl';

/** @internal */
let g_log: IpcBusLogConfig;

/** @internal */
export const CreateIpcBusLog = (): IpcBusLogConfig => {
    if (g_log == null) {
        g_log = new IpcBusLogConfigImpl();
    }
    return g_log;
};
