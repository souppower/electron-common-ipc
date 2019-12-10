import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import * as IpcBusUtils from '../IpcBusUtils';

import { IpcBusBroker } from './IpcBusBroker';
import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';
import { IpcBusBrokerJSONLogger } from './IpcBusBrokerJSONLogger';
import { IpcBusBrokerCSVLogger } from './IpcBusBrokerCSVLogger';

export const CreateIpcBusBroker: IpcBusBroker.CreateFunction = (): IpcBusBroker => {
    let ipcBusBroker: IpcBusBroker = null;
    const electronProcessType = GetElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBroker process type = ${electronProcessType}`);
    switch (electronProcessType) {
        case 'main':
        case 'node':
            const logPath = process.env['ELECTRON_IPC_BROKER_LOG_JSON'];
            if (logPath) {
                ipcBusBroker = new IpcBusBrokerJSONLogger(electronProcessType, logPath);
            }
            else {
                const logPath = process.env['ELECTRON_IPC_BROKER_LOG_CSV'];
                if (logPath) {
                    ipcBusBroker = new IpcBusBrokerCSVLogger(electronProcessType, logPath);
                }
                else {
                    ipcBusBroker = new IpcBusBrokerImpl(electronProcessType);
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

IpcBusBroker.Create = CreateIpcBusBroker;