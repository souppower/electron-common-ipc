export * from './electron-common-ipc-common';

export * from './IpcBus/IpcBusClient-factory';

export * from './IpcBus/node/IpcBusBroker';
export * from './IpcBus/node/IpcBusBroker-factory';
export * from './IpcBus/node/IpcBusClientNet';

export * from './IpcBus/main/IpcBusBridge';
export * from './IpcBus/main/IpcBusBridge-factory';

export * from './IpcBus/log/IpcBusLog';
export * from './IpcBus/log/IpcBusCSVLogger';

// Force to execute code
/** @internal */
import './IpcBus/IpcBusClient-factory';
/** @internal */
import './IpcBus/node/IpcBusBroker-factory';
/** @internal */
import './IpcBus/main/IpcBusBridge-factory';
/** @internal */
import './IpcBus/node/IpcBusClientNet-factory';
/** @internal */
import './IpcBus/log/IpcBusLogImpl';

/** @internal */
import { SetLogLevelCVS } from './IpcBus/log/IpcBusCSVLogger';

if (process && process.env && process.env['ELECTRON_IPC_LOG'] && process.env['ELECTRON_IPC_LOG_CSV']) {
    SetLogLevelCVS(Number(process.env['ELECTRON_IPC_LOG']), process.env['ELECTRON_IPC_LOG_CSV']);
}

/** @internal */
import { SetLogLevelJSON } from './IpcBus/log/IpcBusJSONLogger';

if (process && process.env && process.env['ELECTRON_IPC_LOG'] && process.env['ELECTRON_IPC_LOG_JSON']) {
    SetLogLevelJSON(Number(process.env['ELECTRON_IPC_LOG']), process.env['ELECTRON_IPC_LOG_JSON']);
}
