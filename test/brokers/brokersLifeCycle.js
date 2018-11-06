
const ipcBusModule = require('../../lib/electron-common-ipc');
const childProcess = require('child_process');
const electronApp = require('electron').app;
const sph = require('socket-port-helpers');
const path = require('path');
const minimist = require('minimist');

const trace = false;

let ipcBusBroker;
let ipcBusBridge;

let processBroker;

//let localBusPath = '\\tr-ipc-bus\\';
let localBusPath = '/tr-ipc-bus/test';

let args = minimist(process.argv.slice(1));
let timeoutDelay = 10000;
if (args.busTimeout) {
  timeoutDelay = parseInt(args.busTimeout);
}

function _startRemoteBrokers(ipcBusPath) {
  return new Promise((resolve, reject) => {
    const args = [
      path.join(__dirname, './brokerNodeInstance.js'),
      `--busPath=${ipcBusPath}`,
      // `--inspect`
      // `--busTimeout=${timeoutDelay}`
    ];
    let options = { env: {} };
    for (let key of Object.keys(process.env)) {
      options.env[key] = process.env[key];
    }
    options.env['ELECTRON_RUN_AS_NODE'] = '1';
    options['stdio'] = ['pipe', 'pipe', 'pipe', 'ipc'];
    processBroker = childProcess.spawn(process.argv[0], args, options);
    processBroker.stdout.addListener('data', data => { trace && console.log('<Bus Broker Node> ' + data.toString()); });
    processBroker.stderr.addListener('data', data => { trace && console.log('<Bus Broker Node> ' + data.toString()); });
    processBroker.on('message', function (msg) {
      switch (msg.event) {
        case 'resolve':
          trace && console.log('Remote broker is started');
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

function _getBusPath(busPath) {
  if (busPath == null) {
    // https://en.wikipedia.org/wiki/Ephemeral_port
    let port = 49152;
    return sph.findFirstFreePort({ portRange: `>=${port}`, log: false });
  }
  else {
    return Promise.resolve(busPath);
  }
}

function _startBroker(remoteBroker, ipcBusPath) {
  return Promise.resolve()
    .then(() => {
      if (remoteBroker) {
        return _startRemoteBrokers(ipcBusPath);
      }
      else {
        // Create broker
        ipcBusBroker = ipcBusModule.CreateIpcBusBroker(ipcBusPath);
        // Start broker
        trace && console.log('IpcBusBroker starting...');
        return ipcBusBroker.start({ timeoutDelay })
      }
    })
    .then((msg) => {
      trace && console.log('IpcBusBroker started');
    })
    .catch((err) => {
      console.log(`IpcBusBroker started failed ${err}`);
      throw err;
    })
}

function _startBridge(ipcBusPath) {
  // Create bridge
  trace && console.log('IpcBusBridge starting...');
  ipcBusBridge = ipcBusModule.CreateIpcBusBridge(ipcBusPath);
  // Start bridge
  return ipcBusBridge.start({ timeoutDelay })
    .then((msg) => {
      trace && console.log('IpcBusBridge started');
    })
    .catch((err) => {
      console.log(`IpcBusBridge started failed ${err}`);
      throw err;
    });
}

function _startBrokers(remoteBroker, busPath) {
  return _getBusPath(busPath)
    .then((ipcBusPath) => {
      return _startBroker(remoteBroker, ipcBusPath)
        .then(() => {
          return _startBridge(ipcBusPath);
        })
        .then(() => {
          return ipcBusPath;
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
  trace && console.log('IpcBusBridge stopping...');
  return ipcBusBridge.stop()
    .then(() => {
      ipcBusBridge = null;
      trace && console.log('IpcBusBridge stopped');
    })
    .catch((err) => {
      console.log(`IpcBusBridge stopped failed ${err}`);
      throw err;
    })
    .then(() => {
      trace && console.log('IpcBusBroker stopping...');
      if (remoteBroker) {
        return _stopRemoteBroker();
      }
      else {
        return ipcBusBroker.stop();
      }
    })
    .then(() => {
      ipcBusBroker = null;
      trace && console.log('IpcBusBroker stopped');
    })
    .catch((err) => {
      console.log(`IpcBusBroker stopped failed ${err}`);
      throw err;
    });
}

function startBrokers(remoteBroker, busPath) {
  if (electronApp.isReady()) {
    return _startBrokers(remoteBroker, busPath)
  }

  return new Promise((resolve, reject) => {
    electronApp.on('ready', () => {
      _startBrokers(remoteBroker, busPath)
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
exports.timeoutDelay = timeoutDelay;
exports.localBusPath = localBusPath;
