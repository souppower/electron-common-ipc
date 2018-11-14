import { IpcBusClient } from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusClientTransportRenderer } from './IpcBusClientTransportRenderer';
import { CrossFrameEventEmitter, IpcBusFrameBridge } from './CrossFrameEventEmitter';

const trace = true;

// This function could be called in advance in the preload file of the BrowserWindow
// Then ipcbus is supported in sandbox or nodeIntegration=false process

// By default this function is always trigerred in index-browser in order to offer an access to ipcBus

export function PreloadElectronCommonIpcAutomatic(): boolean {
    return _PreloadElectronCommonIpc('Implicit');
}

export function PreloadElectronCommonIpc(): boolean {
    return _PreloadElectronCommonIpc('Explicit');
}


function _PreloadElectronCommonIpc(context: string): boolean {
    const windowLocal = window as any;
    try {
        windowLocal.ElectronCommonIpc = windowLocal.ElectronCommonIpc || {};
        if (windowLocal.ElectronCommonIpc.CreateIpcBusClient == null) {
            const electron = require('electron');
            if (electron && electron.ipcRenderer) {
                trace && console.log(`${context} - Inject ElectronCommonIpc.CreateIpcBusClient`);
                windowLocal.ElectronCommonIpc.CreateIpcBusClient = (options: any, hostname?: string) => {
                    let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
                    let ipcBusClient: IpcBusClient = new IpcBusClientTransportRenderer('renderer', localOptions || {}, electron.ipcRenderer);
                    return ipcBusClient;
                };
            }
        }
        else {
            trace && console.log(`${context} - Already ElectronCommonIpc.CreateIpcBusClient`);
        }
}
    catch (_) {
    }

    try {
        windowLocal.ElectronCommonIpc = windowLocal.ElectronCommonIpc || {};
        if (windowLocal.self === windowLocal.top) {
            if (windowLocal.ElectronCommonIpc.FrameBridge == null) {
                const electron = require('electron');
                if (electron && electron.ipcRenderer) {
                    trace && console.log(`${context} - Inject ElectronCommonIpc.FrameBridge`);
                    windowLocal.ElectronCommonIpc.FrameBridge = new IpcBusFrameBridge(electron.ipcRenderer, window);
                }
            }
            else {
                trace && console.log(`${context} - FrameSet ElectronCommonIpc.FrameBridge`);
            }
            return true;
        }
        else {
            if (windowLocal.ElectronCommonIpc.CreateIpcBusClient == null) {
                let crossFrameEE = new CrossFrameEventEmitter(window.parent);
                windowLocal.ElectronCommonIpc.CreateIpcBusClient = (options: any, hostname?: string) => {
                    trace && console.log(`${context} - Inject Frame ElectronCommonIpc.CreateIpcBusClient`);
                    let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
                    let ipcBusClient: IpcBusClient = new IpcBusClientTransportRenderer('renderer', localOptions || {}, crossFrameEE);
                    return ipcBusClient;
                };
            }
            else {
                trace && console.log(`${context} - Frame ElectronCommonIpc.CreateIpcBusClient`);
            }
            return true;
        }
    }
    catch (_) {
    }
    return false;
}

export function IsElectronCommonIpcAvailable(): boolean {
    try {
        const windowLocal = window as any;
        return (windowLocal.ElectronCommonIpc && windowLocal.ElectronCommonIpc.CreateIpcBusClient) != null;
    }
    catch (_) {
    }
    return false;
 }