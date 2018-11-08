export function PreloadIpcBusTransport() {
    const windowLocal = window as any;
    windowLocal.IpcBusTransportInWindow = require('electron').ipcRenderer;

    // TODO - Register frame support in topframe : postMessage stuff
}