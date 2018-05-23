
const ipcBusModule = require('../lib/electron-common-ipc');
const electronApp = require('electron').app;

const ipcBusPath = 50494;
let ipcBusBroker;
let ipcBusBridge;

function _startBrokers() {
  // Create broker
  ipcBusBroker = ipcBusModule.CreateIpcBusBroker(ipcBusPath);
  // Start broker
  return ipcBusBroker.start()
    .then((msg) => {
      console.log('IpcBusBroker started');
    })
    .catch((err) => {
      console.log(`IpcBusBroker started failed ${err}`);
      throw err;
    })
    .then((msg) => {
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
}

function _stopBrokers() {
  return ipcBusBridge.stop()
    .then(() => {
      ipcBusBridge = null;
      console.log('IpcBusBridge stopped');
    })
    .catch((err) => {
      console.log(`IpcBusBridge stopped failed ${err}`);
      throw err;
    })
    .then(() => {
      return ipcBusBroker.stop()
        .then(() => {
          ipcBusBroker = null;
          console.log('IpcBusBroker stopped');
        })
        .catch((err) => {
          console.log(`IpcBusBroker stopped failed ${err}`);
          throw err;
        });
    })
}

function startBrokers() {
  if (electronApp.isReady()) {
    return _startBrokers()
  }

  return new Promise((resolve, reject) => {
    electronApp.on('ready', () => {
      _startBrokers()
        .then(() => {
          resolve();
        })
        .catch((err) => {
          reject(err);
        });
    });
  });
}

function stopBrokers() {
  if (electronApp.isReady()) {
    return _stopBrokers()
  }

  return new Promise((resolve, reject) => {
    electronApp.on('ready', () => {
      _stopBrokers()
        .then(() => {
          resolve();
        })
        .catch((err) => {
          reject(err);
        });
    });
  });
}


exports.startBrokers = startBrokers;
exports.stopBrokers = stopBrokers;
exports.ipcBusPath = ipcBusPath;