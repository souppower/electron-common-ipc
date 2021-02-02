import { Create as CreateIpcBusClientWindow } from './IpcBusClientRenderer-factory';

// let useContextBridge = process.argv.includes('--context-isolation');
	// if (useContextBridge) {
	// 	try {
	// 		contextBridge.exposeInMainWorld('vscode', globals);
	// 	} catch (error) {
	// 		console.error(error);

	// 		useContextBridge = false;
	// 	}
	// }

	// if (!useContextBridge) {
	// 	// @ts-ignore
	// 	window.vscode = globals;
	// }

// const globals = {
//     ElectronCommonIpc: {
//         CreateIpcBusClient() {
//             // Will work in a preload or with nodeIntegration=true
//             const electron = require('electron');
//             if (electron && electron.ipcRenderer) {
//                 const ipcBusClient = CreateIpcBusClientWindow('renderer', electron.ipcRenderer as any);
//                 return ipcBusClient;
//             }
//         },
//         FrameBridge: {

//         }
//     }
// }

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
    try {
        // Will work in a preload or with nodeIntegration=true
        const electron = require('electron');
        if (electron && electron.ipcRenderer) {
            // console.log(electron.webFrame);
            // console.log(electron.webFrame.routingId);
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
        }
    }
    catch (_) {
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