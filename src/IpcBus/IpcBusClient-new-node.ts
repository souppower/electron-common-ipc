import type { IpcBusClient } from './IpcBusClient';
import type { ElectronProcessType } from 'electron-process-type/lib/v2';
import { Create } from './node/IpcBusClientSocket-factory';

/** @internal */
export function NewIpcBusClient(electronProcessType: ElectronProcessType): IpcBusClient {
    return Create(electronProcessType);
};
