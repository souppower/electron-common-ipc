import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import { IpcBusContextType } from '../IpcBusClient';
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
    let electronProcessType = GetElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBroker process type = ${electronProcessType} on ${JSON.stringify(options)}`);
    switch (electronProcessType) {
        case 'main':
        case 'node':
            let logPath = process.env['ELECTRON_IPC_BROKER_LOG_JSON'];
            if (logPath) {
                ipcBusBroker = new IpcBusBrokerJSONLogger(logPath, electronProcessType as IpcBusContextType, localOptions);
            }
            else {
                let logPath = process.env['ELECTRON_IPC_BROKER_LOG_CSV'];
                if (logPath) {
                    ipcBusBroker = new IpcBusBrokerCSVLogger(logPath, electronProcessType as IpcBusContextType, localOptions);
                }
                else {
                    ipcBusBroker = new IpcBusBrokerImpl(electronProcessType as IpcBusContextType, localOptions);
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
