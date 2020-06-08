const electronCommonIpcModule = require('electron-common-ipc');
electronCommonIpcModule.PreloadElectronCommonIpc();

console.log(`IsElectronCommonIpcAvailable=${electronCommonIpcModule.IsElectronCommonIpcAvailable()}`);

const electron = require('electron');
window.ipcRenderer = electron.ipcRenderer;

