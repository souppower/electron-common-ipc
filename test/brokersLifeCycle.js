
const ipcBusModule = require('../lib/electron-common-ipc');
const electronApp = require('electron').app;
const sph = require('socket-port-helpers');

let ipcBusBroker;
let ipcBusBridge;

function _startBrokers() {
  //  // https://en.wikipedia.org/wiki/Ephemeral_port
   let port = 49152;
   return sph.findFirstFreePort({portRange: `>=${port}`, log: false})
   .then((ipcBusPath) => {
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
            return port;
          })
          .catch((err) => {
            console.log(`IpcBusBridge started failed ${err}`);
            throw err;
          });
      })
    });
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
