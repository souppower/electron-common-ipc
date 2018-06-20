
// import * as IpcBusInterfaces from './IpcBusInterfaces';
import { IpcBusClient, IpcBusProcessType } from './IpcBusInterfaces';
// import { IpcBusRequestResponse } from './IpcBusInterfaces';
// export * from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusBroker } from './IpcBusInterfaces';
import { IpcBusBridge  } from './IpcBusInterfaces';

import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';
import { IpcBusBrokerLogger } from './IpcBusBrokerLogger';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusBridgeLogger } from './IpcBusBridgeLogger';

import { IpcBusClientTransportNode } from './IpcBusClientTransportNode';
import { IpcBusClientTransportRenderer } from './IpcBusClientTransportRenderer';

import * as ElectronUtils from './ElectronUtils';

export let CreateIpcBusBroker: IpcBusBroker.CreateFunction = (options: any, hostname?: string): IpcBusBroker => {
    let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
    if (!localOptions) {
        return null;
    }

    let ipcBusBroker: IpcBusBroker = null;
    let processType = ElectronUtils.GuessElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBroker process type = ${processType} on ${JSON.stringify(options)}`);
    switch (processType) {
        case 'browser':
        case 'node':
            let logPath = process.env['ELECTRON_IPC_BROKER_LOGPATH'];
            if (logPath) {
                ipcBusBroker = new IpcBusBrokerLogger(logPath, processType as IpcBusProcessType, localOptions);
            }
            else {
                ipcBusBroker = new IpcBusBrokerImpl(processType as IpcBusProcessType, localOptions);
            }
            break;
        // not supported process
        case 'renderer':
        default:
            break;
    }
    return ipcBusBroker;
};

export let CreateIpcBusBridge: IpcBusBridge.CreateFunction = (options: any, hostname?: string): IpcBusBridge => {
    let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
    if (!localOptions) {
        return null;
    }

    let ipcBusBridge: IpcBusBridge = null;
    let processType = ElectronUtils.GuessElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBridge process type = ${processType} on ${JSON.stringify(options)}`);
    switch (processType) {
        case 'browser':
            let logPath = process.env['ELECTRON_IPC_BRIDGE_LOGPATH'];
            if (logPath) {
                ipcBusBridge = new IpcBusBridgeLogger(logPath, processType as IpcBusProcessType, localOptions);
            }
            else {
                ipcBusBridge = new IpcBusBridgeImpl(processType as IpcBusProcessType, localOptions);
            }
            break;
        // not supported process
        case 'renderer':
        case 'node':
        default:
            break;
    }
    return ipcBusBridge;
};

export let CreateIpcBusClient: IpcBusClient.CreateFunction = (options: any, hostname?: string): IpcBusClient => {
    let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
    let processType = ElectronUtils.GuessElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`CreateIpcBusForProcess process type = ${processType} on ${JSON.stringify(options)}`);
    let ipcBusClient: IpcBusClient = null;
    switch (processType) {
        // This case 'renderer' is not reachable as IpcBusApi-browser is used in a browser (see browserify 'browser' field in package.json)
        case 'renderer':
            ipcBusClient = new IpcBusClientTransportRenderer(processType, localOptions || {});
            break;
        case 'browser':
        case 'node':
                if (localOptions) {
                    ipcBusClient = new IpcBusClientTransportNode(processType, localOptions);
                }
            break;
    }
    return ipcBusClient;
};
