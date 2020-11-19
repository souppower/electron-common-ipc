import type { ElectronProcessType } from 'electron-process-type/lib/v2';
import type { IpcBusBroker } from './IpcBusBroker';
import { IpcBusBrokerNode } from './IpcBusBrokerNode';

/** @internal */
export function NewIpcBusBroker(electronProcessType: ElectronProcessType): IpcBusBroker | null {
    return new IpcBusBrokerNode(electronProcessType);
};
