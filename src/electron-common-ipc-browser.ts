// Purpose of this is to limit dependencies when ipc-bus is bundled in a renderer.

export * from './IpcBus/IpcBusClient';
// export * from './IpcBus/IpcBusBridge';
// export * from './IpcBus/IpcBusBroker';

export {CreateIpcBusService} from './IpcBus/IpcBusApi-browser';
export {CreateIpcBusServiceProxy} from './IpcBus/IpcBusApi-browser';
export {ActivateIpcBusTrace} from './IpcBus/IpcBusApi-browser';
export {ActivateServiceTrace} from './IpcBus/IpcBusApi-browser';

import { IpcBusClient } from './IpcBus/IpcBusClient';
import { CreateIpcBusClientRenderer } from './IpcBus/IpcBusApi-browser';

export let CreateIpcBusClient: IpcBusClient.CreateFunction = CreateIpcBusClientRenderer;
