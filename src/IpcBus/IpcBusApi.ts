
// import * as IpcBusInterfaces from './IpcBusInterfaces';
import { IpcBusClient, IpcBusProcessType } from './IpcBusInterfaces';
// import { IpcBusRequestResponse } from './IpcBusInterfaces';
// export * from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusBroker } from './IpcBusInterfaces';
import { IpcBusBridge } from './IpcBusInterfaces';

import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';
import { IpcBusBrokerLogger } from './IpcBusBrokerLogger';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusBridgeLogger } from './IpcBusBridgeLogger';

import { IpcBusTransportNode } from './IpcBusTransportNode';
import { IpcBusTransportRenderer } from './IpcBusTransportRenderer';

import { IpcBusTransport} from './IpcBusTransport';

import * as ElectronUtils from './ElectronUtils';

/** @internal */
export function _CreateIpcBusBroker(busPath?: string): IpcBusBroker {
    let ipcBusBroker: IpcBusBroker = null;

    let ipcOptions = IpcBusUtils.ExtractIpcOptions(busPath);
    let processType = ElectronUtils.GuessElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBroker process type = ${processType} on ${JSON.stringify(ipcOptions)}`);
    switch (processType) {
        case 'browser':
        case 'node':
            if (ipcOptions.isValid()) {
                let logPath = process.env['ELECTRON_IPC_BROKER_LOGPATH'];
                if (logPath) {
                    ipcBusBroker = new IpcBusBrokerLogger(logPath, processType as IpcBusProcessType, ipcOptions);
                }
                else {
                    ipcBusBroker = new IpcBusBrokerImpl(processType as IpcBusProcessType, ipcOptions);
                }
            }
            break;
        // not supported process
        case 'renderer':
        default:
            break;
    }
    return ipcBusBroker;
}

/** @internal */
export function _CreateIpcBusBridge(busPath?: string): IpcBusBridge | null{
    let ipcOptions = IpcBusUtils.ExtractIpcOptions(busPath);
    if (!ipcOptions.isValid()) {
        return null;
    }
    let processType = ElectronUtils.GuessElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBridge process type = ${processType} on ${JSON.stringify(ipcOptions)}`);
    let ipcBusBridge: IpcBusBridge = null;
    switch (processType) {
        case 'browser':
            let logPath = process.env['ELECTRON_IPC_BRIDGE_LOGPATH'];
            if (logPath) {
                ipcBusBridge = new IpcBusBridgeLogger(logPath, processType as IpcBusProcessType, ipcOptions);
            }
            else {
                ipcBusBridge = new IpcBusBridgeImpl(processType as IpcBusProcessType, ipcOptions);
            }
            break;
        // not supported process
        case 'renderer':
        case 'node':
        default:
            break;
    }
    return ipcBusBridge;
}

/** @internal */
export function _CreateIpcBusClient(busPath?: string): IpcBusClient | null {
    let ipcOptions = IpcBusUtils.ExtractIpcOptions(busPath);
    if (!ipcOptions.isValid()) {
        return null;
    }
    let processType = ElectronUtils.GuessElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`CreateIpcBusForProcess process type = ${processType} on ${JSON.stringify(ipcOptions)}`);
    let ipcBusTransport: IpcBusTransport = null;
    switch (processType) {
        // This case 'renderer' is not reachable as IpcBusApi-browser is used in a browser (see browserify 'browser' field in package.json)
        case 'renderer':
            ipcBusTransport = new IpcBusTransportRenderer(processType, ipcOptions);
            break;
        case 'browser':
        case 'node':
            ipcBusTransport = new IpcBusTransportNode(processType, ipcOptions);
            break;
    }
    return ipcBusTransport.client;
}
