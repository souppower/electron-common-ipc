export * from './electron-common-ipc-common';

export * from './IpcBus/IpcBusClient-factory-browser';

// Force to execute code
import './IpcBus/IpcBusClient-factory-browser';

import { PreloadElectronCommonIpcAutomatic } from './IpcBus/renderer/IpcBusRendererPreload';
PreloadElectronCommonIpcAutomatic();

