
import { IpcBusClient } from './IpcBusClient';
// import * as IpcBusUtils from './IpcBusUtils';

// import { IpcBusClientRenderer } from './IpcBusClientRenderer';

const windowLocal = window as any;
windowLocal.CreateIpcBusClient = () => {
    const windowLocal = window as any;
    if (windowLocal.ElectronCommonIpc && windowLocal.ElectronCommonIpc.CreateIpcBusClient) {
        return windowLocal.ElectronCommonIpc.CreateIpcBusClient();
    }
    return null;
};

IpcBusClient.Create = windowLocal.CreateIpcBusClient;
