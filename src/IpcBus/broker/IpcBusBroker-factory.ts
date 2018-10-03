import { GetElectronProcessType } from 'electron-process-type';

import { IpcBusProcessType } from '../IpcBusClient';
import * as IpcBusUtils from '../IpcBusUtils';

import { IpcBusBroker } from './IpcBusBroker';
import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';
import { IpcBusBrokerJSONLogger } from './IpcBusBrokerJSONLogger';
import { IpcBusBrokerCSVLogger } from './IpcBusBrokerCSVLogger';

export let CreateIpcBusBroker: IpcBusBroker.CreateFunction = (options: any, hostname?: string): IpcBusBroker => {
    let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
    if (!localOptions) {
        return null;
    }

    let ipcBusBroker: IpcBusBroker = null;
    let processType = GetElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBroker process type = ${processType} on ${JSON.stringify(options)}`);
    switch (processType) {
        case 'browser':
        case 'node':
            let logPath = process.env['ELECTRON_IPC_BROKER_LOG_JSON'];
            if (logPath) {
                ipcBusBroker = new IpcBusBrokerJSONLogger(logPath, processType as IpcBusProcessType, localOptions);
            }
            else {
                let logPath = process.env['ELECTRON_IPC_BROKER_LOG_CSV'];
                if (logPath) {
                    ipcBusBroker = new IpcBusBrokerCSVLogger(logPath, processType as IpcBusProcessType, localOptions);
                }
                else {
                    ipcBusBroker = new IpcBusBrokerImpl(processType as IpcBusProcessType, localOptions);
                }
            }
            break;
        // not supported process
        case 'renderer':
        default:
            break;
    }
    return ipcBusBroker;
};
