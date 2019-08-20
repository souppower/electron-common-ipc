export * from './electron-common-ipc-common';

export * from './IpcBus/IpcBusClient-factory-browser';

import { PreloadElectronCommonIpcAutomatic } from './IpcBus/IpcBusRendererPreload';
PreloadElectronCommonIpcAutomatic();
