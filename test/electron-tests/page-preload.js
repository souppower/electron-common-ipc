const electronCommonIpcModule = require('../..');
electronCommonIpcModule.PreloadElectronCommonIpc();

console.log(`IsElectronCommonIpcAvailable=${electronCommonIpcModule.IsElectronCommonIpcAvailable()}`);

const ipcRenderer = require('electron').ipcRenderer;
window.ipcRenderer = ipcRenderer;
