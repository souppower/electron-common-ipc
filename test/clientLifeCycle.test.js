const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const ipcBusModule = require('../lib/electron-common-ipc');
const electronApp = require('electron').app;
const brokersLifeCycle = require('./brokers/brokersLifeCycle');

let timeoutDelay = brokersLifeCycle.timeoutDelay;

function test1(remoteBroker, busPath) {
  describe(`Client ${busPath} ${remoteBroker ? '(Broker in remote)' : ''}`, () => {
    let brokers;
    before(() => {
      brokers = new brokersLifeCycle.Brokers(remoteBroker, busPath);
      return brokers.start();
    });

    after(() => {
      return brokers.stop()
        .catch(() => { })
    });

    let ipcBusClient;
    it(`start client ${busPath}`, () => {
      ipcBusClient = ipcBusModule.CreateIpcBusClient();
      return ipcBusClient.connect(brokers.getBusPath(), { peerName: 'client', timeoutDelay })
    });

    it(`stop client ${busPath}`, async () => {
      return ipcBusClient.close({ timeoutDelay });
    });

  });
}

function test2(remoteBroker, busPath) {
  describe(`Client ${busPath} without closing it ${remoteBroker ? '(Broker in remote)' : ''}`, () => {
    let brokers;
    before(() => {
      brokers = new brokersLifeCycle.Brokers(remoteBroker, busPath);
      return brokers.start();
    });

    after(() => {
      return brokers.stop()
        .catch(() => { })
    });

    let ipcBusClient;
    it(`start client ${busPath}`, () => {
      ipcBusClient = ipcBusModule.CreateIpcBusClient();
      return ipcBusClient.connect(brokers.getBusPath(), { peerName: 'client', timeoutDelay })
    });
  });
}

test1(false);
test2(false);
test1(true);
test2(true);
test1(false, brokersLifeCycle.getLocalBusPath());
test2(false, brokersLifeCycle.getLocalBusPath());
test1(true, brokersLifeCycle.getLocalBusPath());
test2(true, brokersLifeCycle.getLocalBusPath());
