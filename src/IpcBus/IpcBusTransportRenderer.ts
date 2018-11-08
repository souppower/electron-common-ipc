import { EventEmitter } from 'events';

export interface IpcBusTransportInWindow extends EventEmitter {
    send(channel: string, ...args: any[]): void;
}

export function GetIpcBusTransportInWindow(): IpcBusTransportInWindow {
    try {
        const electron = require('electron');
        return electron.ipcRenderer;
    }
    catch (_) {
    }
    const windowLocal = window as any;
    if (windowLocal.IpcBusTransportInWindow) {
        return windowLocal.IpcBusTransportInWindow;
    }
    // TODO - Use postMessage in frame then
    return null;
}
