
import { IpcBusClient } from './IpcBusClient';
// import * as IpcBusUtils from './IpcBusUtils';

// import { IpcBusClientRenderer } from './IpcBusClientRenderer';

const windowLocal = window as any;
export const CreateIpcBusClient: IpcBusClient.CreateFunction = () => {
    if (windowLocal.ElectronCommonIpc && windowLocal.ElectronCommonIpc.CreateIpcBusClient) {
        return windowLocal.ElectronCommonIpc.CreateIpcBusClient();
    }
    return null;
}

windowLocal.CreateIpcBusClient = CreateIpcBusClient;

IpcBusClient.Create = CreateIpcBusClient;
