// Purpose of this is to limit dependencies when ipc-bus is bundled in a renderer.

export * from './IpcBus/IpcBusClientInterfaces';
// export * from './IpcBus/IpcBusBridgeInterfaces';
// export * from './IpcBus/IpcBusBrokerInterfaces';

export {CreateIpcBusService} from './IpcBus/IpcBusApi-browser';
export {CreateIpcBusServiceProxy} from './IpcBus/IpcBusApi-browser';
export {ActivateIpcBusTrace} from './IpcBus/IpcBusApi-browser';
export {ActivateServiceTrace} from './IpcBus/IpcBusApi-browser';

import { IpcBusClient } from './IpcBus/IpcBusClientInterfaces';
import { CreateIpcBusClientRenderer } from './IpcBus/IpcBusApi-browser';

export let CreateIpcBusClient: IpcBusClient.CreateFunction = CreateIpcBusClientRenderer;
