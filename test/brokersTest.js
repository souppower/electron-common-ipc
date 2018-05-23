const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const ipcBusModule = require('../lib/electron-common-ipc');
const electronApp = require('electron').app;
const brokersLifeCycle = require('./brokersLifeCycle');

describe('Brokers', () => {
  it('start brokers', (done) => {
    if (electronApp.isReady()) {
      brokersLifeCycle.startBrokers()
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    }

    // Startup
    electronApp.on('ready', () => {
      brokersLifeCycle.startBrokers()
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
      brokersLifeCycle.stopBrokers()
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    }

    // Startup
    electronApp.on('ready', () => {
      brokersLifeCycle.stopBrokers()
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });


});

