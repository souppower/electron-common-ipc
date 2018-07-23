
const ipcBusModule = require('../../lib/electron-common-ipc');
const childProcess = require('child_process');
const electronApp = require('electron').app;
const sph = require('socket-port-helpers');
const path = require('path');

let ipcBusBroker;
let ipcBusBridge;

let processBroker;

function _startRemoteBrokers(ipcBusPath) {
  return new Promise((resolve, reject) => {
    const args = [
      path.join(__dirname, './brokerNodeInstance.js'),
      `--busPath=${ipcBusPath}`,
      `--inspect`
      // `--busTimeout=${timeoutDelay}`
    ];
    let options = { env: {} };
    for (let key of Object.keys(process.env)) {
      options.env[key] = process.env[key];
    }
    options.env['ELECTRON_RUN_AS_NODE'] = '1';
    options['stdio'] = ['pipe', 'pipe', 'pipe', 'ipc'];
    processBroker = childProcess.spawn(process.argv[0], args, options);
    processBroker.stdout.addListener('data', data => { console.log('<Bus Broker Node> ' + data.toString()); });
    processBroker.stderr.addListener('data', data => { console.log('<Bus Broker Node> ' + data.toString()); });
    processBroker.on('message', function (msg) {
      switch (msg.event) {
        case 'resolve':
          console.log('Remote brokers are started');
          resolve();
          break;
        case 'reject':
          console.log(`Remote brokers do not start ${msg.err}`);
          reject(msg.err);
          break;
      }
    });
  });
}

function _startBrokers(remoteBroker) {
  // https://en.wikipedia.org/wiki/Ephemeral_port
  let port = 49152;
  return sph.findFirstFreePort({ portRange: `>=${port}`, log: false })
    .then((ipcBusPath) => {
      return Promise.resolve()
        .then(() => {
          if (remoteBroker) {
            return _startRemoteBrokers(ipcBusPath);
          }
          else {
            // Create broker
            ipcBusBroker = ipcBusModule.CreateIpcBusBroker(ipcBusPath);
            // Start broker
            console.log('IpcBusBroker starting...');
            return ipcBusBroker.start()
          }
        })
        .then((msg) => {
          console.log('IpcBusBroker started');
        })
        .catch((err) => {
          console.log(`IpcBusBroker started failed ${err}`);
          throw err;
        })
        .then((msg) => {
          // Create bridge
          console.log('IpcBusBridge starting...');
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
        });
    });
}

function _stopRemoteBroker() {
  return new Promise((resolve, reject) => {
    if (processBroker) {
      processBroker.on('error', () => {
        resolve();
      });
      processBroker.on('exit', () => {
        resolve();
      });
      processBroker.send('term');
      processBroker = null;
    }
    else {
      resolve();
    }
  });
}

function _stopBrokers(remoteBroker) {
  console.log('IpcBusBridge stopping...');
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
      console.log('IpcBusBroker stopping...');
      if (remoteBroker) {
        return _stopRemoteBroker();
      }
      else {
        return ipcBusBroker.stop();
      }
    })
    .then(() => {
      ipcBusBroker = null;
      console.log('IpcBusBroker stopped');
    })
    .catch((err) => {
      console.log(`IpcBusBroker stopped failed ${err}`);
      throw err;
    });
}

function startBrokers(remoteBroker) {
  if (electronApp.isReady()) {
    return _startBrokers(remoteBroker)
  }

  return new Promise((resolve, reject) => {
    electronApp.on('ready', () => {
      _startBrokers(remoteBroker)
        .then(() => {
          resolve();
        })
        .catch((err) => {
          reject(err);
        });
    });
  });
}

function stopBrokers(remoteBroker) {
  if (electronApp.isReady()) {
    return _stopBrokers(remoteBroker)
  }

  return new Promise((resolve, reject) => {
    electronApp.on('ready', () => {
      _stopBrokers(remoteBroker)
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
