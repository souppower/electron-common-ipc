import { IpcBusClient } from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusClientTransportRenderer } from './IpcBusClientTransportRenderer';

// This function could be called in advance in the preload file of the BrowserWindow
// Then ipcbus is supported in sandbox or nodeIntegration=false process

// By default this function is always trigerred in index-browser in order to offer an access to ipcBus
export function PreloadElectronCommonIpc() {
    try {
        const windowLocal = window as any;
        if (windowLocal.CreateIpcBusClient == null) {
            const electron = require('electron');
            if (electron && electron.ipcRenderer) {
                windowLocal.CreateIpcBusClient = (options: any, hostname?: string) => {
                    let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
                    let ipcBusClient: IpcBusClient = new IpcBusClientTransportRenderer('renderer', localOptions || {}, electron.ipcRenderer);
                    return ipcBusClient;
                };
            }
        }
    }
    catch (_) {
    }
    // TODO - Register frame support in topframe : postMessage stuff
}

export function IsElectronCommonIpcAvailable(): boolean {
    try {
        const windowLocal = window as any;
        return windowLocal.CreateIpcBusClient;
    }
    catch (_) {
    }
    return false;
 }