const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const ipcBusModule = require('../lib/electron-common-ipc');
const electronApp = require('electron').app;

describe('Brokers', () => {
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
        console.log('IpcBusBridge stopped');
        return ipcBusBroker.stop()
          .then(() => {
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


  it('start brokers', (done) => {
    if (electronApp.isReady()) {
      startBrokers()
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    }

    // Startup
    electronApp.on('ready', () => {
      startBrokers()
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  it('stop brokers', (done) => {
    if (electronApp.isReady()) {
      stopBrokers()
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    }

    // Startup
    electronApp.on('ready', () => {
      stopBrokers()
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });


});

