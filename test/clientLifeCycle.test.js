const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const ipcBusModule = require('../lib/electron-common-ipc');
const electronApp = require('electron').app;
const brokersLifeCycle = require('./brokers/brokersLifeCycle');

function test(remoteBroker, busPath) {
  describe(`Client ${busPath} ${remoteBroker ? '(Broker in remote)' : ''}`, () => {
    let brokers;
    before(() => {
      brokers = new brokersLifeCycle.Brokers(remoteBroker, busPath);
      return brokers.start();
    });

    after(() => {
      return brokers.stop();
    });

    let ipcBusClient;
    it(`start client ${busPath}`, () => {
      ipcBusClient = ipcBusModule.CreateIpcBusClient(brokers.getBusPath());
      return ipcBusClient.connect({ peerName: 'client' })
    });

    it(`stop client ${busPath}`, async () => {
      return ipcBusClient.close();
    });

  });

  describe(`Client ${busPath} without closing it ${remoteBroker ? '(Broker in remote)' : ''}`, () => {
    let brokers;
    before(() => {
      brokers = new brokersLifeCycle.Brokers(remoteBroker, busPath);
      return brokers.start();
    });

    after(() => {
      return brokers.stop();
    });

    let ipcBusClient;
    it(`start client ${busPath}`, () => {
      ipcBusClient = ipcBusModule.CreateIpcBusClient(brokers.getBusPath());
      return ipcBusClient.connect({ peerName: 'client' })
    });
  });
}

// test(false);
// test(true);
test(false, brokersLifeCycle.localBusPath);
test(true, brokersLifeCycle.localBusPath);
