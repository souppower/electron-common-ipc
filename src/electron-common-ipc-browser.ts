export * from './electron-common-ipc-common';

export * from './IpcBus/IpcBusClient-factory-browser';
export * from './IpcBus/log/IpcBusLog-factory-browser';
export * from './IpcBus/service/IpcBusService-factory-browser';

// Force to execute code
/** @internal */
import './IpcBus/IpcBusClient-factory-browser';
/** @internal */
import './IpcBus/log/IpcBusLog-factory-browser';
/** @internal */
import './IpcBus/service/IpcBusService-factory-browser';


import { PreloadElectronCommonIpcAutomatic } from './IpcBus/renderer/IpcBusRendererPreload';
PreloadElectronCommonIpcAutomatic();

