
const ipcBusModule = require('../../lib/electron-common-ipc');
const childProcess = require('child_process');
const electronApp = require('electron').app;
const sph = require('socket-port-helpers');
const path = require('path');
const minimist = require('minimist');

const trace = false;

//let localBusPath = '\\tr-ipc-bus\\';
let localBusPath = '/tr-ipc-bus/test';
let localBusPathCount = 0;

function getLocalBusPath() {
  ++localBusPathCount;
  return `${localBusPath}/${localBusPathCount}`;
}

let args = minimist(process.argv.slice(1));
let timeoutDelay = 5000;
if (process.env['NODE_ENV'] === 'development') {
  timeoutDelay = 20000;
}
if (args.busTimeout) {
  timeoutDelay = parseInt(args.busTimeout);
}

Brokers = (function () {
  function Brokers(remoteBroker, busPath) {
    let ipcBusBridge = null;
    let ipcBusBroker = null;
    let processBroker = null;
        
    this.getBusPath = function() {
      return busPath;
    }

    this.start = function () {
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
    };

    this.stop = function () {
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
    };

    function _getBusPath() {
      if (busPath == null) {
        // https://en.wikipedia.org/wiki/Ephemeral_port
        let port = 49152;
        return sph.findFirstFreePort({ portRange: `>=${port}`, testConnection: true, log: false });
      }
      else {
        return Promise.resolve(busPath);
      }
    }

    function _startBrokers() {
      return _getBusPath()
        .then((resolveBusPath) => {
          busPath = resolveBusPath;
          return _startBroker()
            .then(() => {
              return _startBridge();
            })
            .then(() => {
              return busPath;
            });
        });
    }

    function _startRemoteBrokers() {
      return new Promise((resolve, reject) => {
        const args = [
          path.join(__dirname, './brokerNodeInstance.js'),
          `--busPath=${busPath}`,
          // `--inspect-brk=9000`,
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

    function _startBroker() {
      return Promise.resolve()
        .then(() => {
          if (remoteBroker) {
            return _startRemoteBrokers(busPath);
          }
          else {
            // Create broker
            ipcBusBroker = ipcBusModule.CreateIpcBusBroker();
            // Start broker
            trace && console.log('IpcBusBroker starting...');
            return ipcBusBroker.connect(busPath, { timeoutDelay })
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

    function _startBridge() {
      // Create bridge
      trace && console.log('IpcBusBridge starting...');
      ipcBusBridge = ipcBusModule.CreateIpcBusBridge();
      // Start bridge
      return ipcBusBridge.connect(busPath, { timeoutDelay })
        .then((msg) => {
          trace && console.log('IpcBusBridge started');
        })
        .catch((err) => {
          console.log(`IpcBusBridge started failed ${err}`);
          throw err;
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

    function _stopBrokers() {
      trace && console.log('IpcBusBridge stopping...');
      return ipcBusBridge.close({ timeoutDelay })
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
            return ipcBusBroker.close({ timeoutDelay });
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
  }
  return Brokers;
})();

exports.Brokers = Brokers;
exports.timeoutDelay = timeoutDelay;
exports.getLocalBusPath = getLocalBusPath;
