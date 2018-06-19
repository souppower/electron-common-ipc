// Purpose of this is to limit dependencies when ipc-bus is bundled in a renderer.

export * from './IpcBus/IpcBusInterfaces';

export {CreateIpcBusService} from './IpcBus/IpcBusApi-browser';
export {CreateIpcBusServiceProxy} from './IpcBus/IpcBusApi-browser';
export {ActivateIpcBusTrace} from './IpcBus/IpcBusApi-browser';
export {ActivateServiceTrace} from './IpcBus/IpcBusApi-browser';

import { CreateIpcBusClientFunction} from './IpcBus/IpcBusInterfaces';
import { CreateIpcBusClientRenderer } from './IpcBus/IpcBusApi-browser';

export let CreateIpcBusClient: CreateIpcBusClientFunction = CreateIpcBusClientRenderer;
