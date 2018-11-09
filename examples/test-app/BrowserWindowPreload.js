//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

'use strict';

const electronCommonIpc = require('electron-common-ipc');
electronCommonIpc.PreloadElectronCommonIpc();
electronCommonIpc.ActivateIpcBusTrace(true);
window.ipcBus = electronCommonIpc.CreateIpcBusClient();

window.ipcRenderer = require('electron').ipcRenderer;

const PerfTests = require('./PerfTests.js');
window.perfTests = new PerfTests('renderer');


