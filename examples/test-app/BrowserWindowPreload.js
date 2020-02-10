//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

'use strict';

const electronCommonIpc = require('electron-common-ipc');
if (electronCommonIpc.PreloadElectronCommonIpc()) {
  // electronCommonIpc.ActivateIpcBusTrace(true);
  // window.ipcBus = window.ElectronCommonIpc.CreateIpcBusClient();
  // window.ipcBus.IPCBUS_CHANNEL_QUERY_STATE = electronCommonIpc.IPCBUS_CHANNEL_QUERY_STATE;
}

window.ipcRenderer = require('electron').ipcRenderer;

const PerfTests = require('./PerfTests.js');
window.perfTests = new PerfTests('renderer');

const ProcessConnector = require('./ProcessConnector.js');
window.ProcessConnector = ProcessConnector;


