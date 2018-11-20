import * as IpcBusUtils from './IpcBusUtils';

import { Create as CreateIpcBusClientRenderer } from './IpcBusClientRenderer';
import { Create as CreateIpcBusClientRendererFrame } from './IpcBusClientRendererFrame';

import { CrossFrameEventEmitter, IpcBusFrameBridge } from './CrossFrameEventEmitter2';
// import { CrossFrameEventDispatcher } from './CrossFrameEventEmitter';

const trace = false; // true;

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
    // console.log(`window.href - ${window.location.href}`);
    try {
        if (windowLocal.ElectronCommonIpc == null) {
            if (windowLocal.self === windowLocal.top) {
                const electron = require('electron');
                if (electron && electron.ipcRenderer) {
                    windowLocal.ElectronCommonIpc = windowLocal.ElectronCommonIpc || {};
                    trace && console.log(`${context} - ElectronCommonIpc`);
                    windowLocal.ElectronCommonIpc.CreateIpcBusClient = (options: any, hostname?: string) => {
                        trace && console.log(`${context} - ElectronCommonIpc.CreateIpcBusClient`);
                        let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
                        let ipcBusClient = CreateIpcBusClientRenderer(localOptions || {}, electron.ipcRenderer);
                        return ipcBusClient;
                    };
                    windowLocal.ElectronCommonIpc.FrameBridge = new IpcBusFrameBridge(electron.ipcRenderer, window);
                    // windowLocal.ElectronCommonIpc.Dispatch = new CrossFrameEventDispatcher(window);
                    return true;
                }
            }
        }
        else {
            trace && console.log(`${context} - ElectronCommonIpc`);
            return true;
        }
    }
    catch (_) {
    }

    try {
        if (windowLocal.ElectronCommonIpc == null) {
            if (windowLocal.self !== windowLocal.top) {
                windowLocal.ElectronCommonIpc = windowLocal.ElectronCommonIpc || {};
                let crossFrameEE = new CrossFrameEventEmitter(window.parent);
                trace && console.log(`${context} - Frame ElectronCommonIpc`);
                windowLocal.ElectronCommonIpc.CreateIpcBusClient = (options: any, hostname?: string) => {
                    trace && console.log(`${context} - Frame ElectronCommonIpc.CreateIpcBusClient`);
                    let localOptions = IpcBusUtils.CheckCreateOptions(options, hostname);
                    let ipcBusClient = CreateIpcBusClientRendererFrame(localOptions || {}, crossFrameEE);
                    return ipcBusClient;
                };
            }
            else {
                trace && console.log(`${context} - Frame ElectronCommonIpc`);
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