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
          });
      });
  }

  function stopBrokers() {
    return ipcBusBridge.stop()
      .then(() => {
        console.log('IpcBusBridge stopped');
        return ipcBusBroker.stop()
          .then(() => {
            console.log('IpcBusBroker stopped');
          });
      });
  }


  it('start brokers', (done) => {
    if (electronApp.isReady()) {
      startBrokers()
        .then(() => {
          done();
        });
    }

    // Startup
    electronApp.on('ready', () => {
      startBrokers()
        .then(() => {
          done();
        });
    });
  });

  it('stop brokers', (done) => {
    if (electronApp.isReady()) {
      stopBrokers()
        .then(() => {
          done();
        });
    }

    // Startup
    electronApp.on('ready', () => {
      stopBrokers()
        .then(() => {
          done();
        });
    });
  });


});

