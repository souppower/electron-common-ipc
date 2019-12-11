import { Create as CreateIpcBusClientWindow } from './IpcBusClientWindow';

import { CrossFrameEventEmitter, IpcBusFrameBridge } from './CrossFrameEventEmitter2';
// import { CrossFrameEventDispatcher } from './CrossFrameEventEmitter';

const trace = false; // true;

// This function could be called in advance in the preload file of the BrowserWindow
// Then ipcbus is supported in sandbox or nodeIntegration=false process

// By default this function is always trigerred in index-browser in order to offer an access to ipcBus

export function PreloadElectronCommonIpcAutomatic(): boolean {
    return _PreloadElectronCommonIpc('Implicit');
}

export function PreloadElectronCommonIpc(iframeSupport: boolean = false): boolean {
    return _PreloadElectronCommonIpc('Explicit', iframeSupport);
}

function _PreloadElectronCommonIpc(context: string, iframeSupport: boolean = false): boolean {
    const windowLocal = window as any;
    // console.log(`window.href - ${window.location.href}`);
    if (windowLocal.self === windowLocal.top) {
        try {
            // Will work in a preload or with nodeIntegration=true
            const electron = require('electron');
            if (electron && electron.ipcRenderer) {
                windowLocal.ElectronCommonIpc = windowLocal.ElectronCommonIpc || {};
                if (windowLocal.ElectronCommonIpc.CreateIpcBusClient == null) {
                    trace && console.log(`inject - ${context} - ElectronCommonIpc.CreateIpcBusClient`);
                    windowLocal.ElectronCommonIpc.CreateIpcBusClient = () => {
                        trace && console.log(`${context} - ElectronCommonIpc.CreateIpcBusClient`);
                        // 'ipcRenderer as any', ipcRenderer does not cover all EventListener interface !
                        const ipcBusClient = CreateIpcBusClientWindow('renderer', electron.ipcRenderer as any);
                        return ipcBusClient;
                    };
                }
                if (windowLocal.ElectronCommonIpc.FrameBridge == null) {
                    trace && console.log(`inject - ${context} - ElectronCommonIpc.FrameBridge`);
                    // 'ipcRenderer as any', ipcRenderer does not cover all EventListener interface !
                    windowLocal.ElectronCommonIpc.FrameBridge = new IpcBusFrameBridge(electron.ipcRenderer as any, window);
                }
            }
        }
        catch (_) {
        }

        try {
            const frameBridge = windowLocal.ElectronCommonIpc && windowLocal.ElectronCommonIpc.FrameBridge as IpcBusFrameBridge;
            if (frameBridge) {
                if (iframeSupport) {
                    trace && console.log(`${context} - ElectronCommonIpc.FrameBridge - start`);
                    frameBridge.start();
                }
                else {
                    frameBridge.stop();
                    trace && console.log(`${context} - ElectronCommonIpc.FrameBridge - stop`);
                }
            }
        }
        catch (_) {
        }
    }
    else { // if (windowLocal.self !== windowLocal.top) {
        try {
            windowLocal.ElectronCommonIpc = windowLocal.ElectronCommonIpc || {};
            if (windowLocal.ElectronCommonIpc.CreateIpcBusClient == null) {
                trace && console.log(`${context} - Frame ElectronCommonIpc`);
                const crossFrameEE = new CrossFrameEventEmitter(window.parent);
                windowLocal.ElectronCommonIpc.CreateIpcBusClient = () => {
                    trace && console.log(`${context} - Frame ElectronCommonIpc.CreateIpcBusClient`);
                    const ipcBusClient = CreateIpcBusClientWindow('renderer-frame', crossFrameEE);
                    return ipcBusClient;
                };
            }
        }
        catch (_) {
        }
    }
    return IsElectronCommonIpcAvailable();
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