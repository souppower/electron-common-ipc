
const ipcBusModule = require('../lib/electron-common-ipc');
const electronApp = require('electron').app;

const ipcBusPath = 50494;
let ipcBusBroker;
let ipcBusBridge;

function startBrokers() {
  // Create broker
  ipcBusBroker = ipcBusModule.CreateIpcBusBroker(ipcBusPath);
  // Start broker
  return ipcBusBroker.start()
    .then((msg) => {
      console.log('IpcBusBroker started');

      // Create bridge
      ipcBusBridge = ipcBusModule.CreateIpcBusBridge(ipcBusPath);
      // Start bridge
      return ipcBusBridge.start()
        .then((msg) => {
          console.log('IpcBusBridge started');
        })
        .catch((err) => {
          console.log(`IpcBusBridge started failed ${err}`);
          throw err;
        });
    })
    .catch((err) => {
      console.log(`IpcBusBroker started failed ${err}`);
      throw err;
    });
}

function stopBrokers() {
  return ipcBusBridge.stop()
    .then(() => {
      ipcBusBridge = null;
      console.log('IpcBusBridge stopped');
      return ipcBusBroker.stop()
        .then(() => {
          ipcBusBroker = null;
          console.log('IpcBusBroker stopped');
        })
        .catch((err) => {
          console.log(`IpcBusBridge stopped failed ${err}`);
          throw err;
        });
    })
    .catch((err) => {
      console.log(`IpcBusBroker stopped failed ${err}`);
      throw err;
    });
}

exports.startBrokers = startBrokers;
exports.stopBrokers = stopBrokers;