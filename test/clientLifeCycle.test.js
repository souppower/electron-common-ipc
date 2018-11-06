const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const ipcBusModule = require('../lib/electron-common-ipc');
const electronApp = require('electron').app;
const brokersLifeCycle = require('./brokers/brokersLifeCycle');

function test(remoteBroker, busPath) {
  describe(`Client ${busPath} ${remoteBroker ? '(Broker in remote)' : ''}`, () => {
    let ipcBusPath;

    before(async () => {
      return brokersLifeCycle.startBrokers(remoteBroker, busPath)
        .then((port) => {
          ipcBusPath = port;
        });
    });

    after(async () => {
      return brokersLifeCycle.stopBrokers(remoteBroker);
    });

    let ipcBusClient;
    it(`start client ${busPath}`, async () => {
      ipcBusClient = ipcBusModule.CreateIpcBusClient(ipcBusPath);
      return ipcBusClient.connect({ peerName: 'client' })
    });

    it(`stop client ${busPath}`, async () => {
      return ipcBusClient.close();
    });

  });

  describe(`Client ${busPath} without closing it ${remoteBroker ? '(Broker in remote)' : ''}`, () => {
    let ipcBusPath;

    before(async () => {
      return brokersLifeCycle.startBrokers(remoteBroker)
        .then((port) => {
          ipcBusPath = port;
        });
    });

    after(async () => {
      return brokersLifeCycle.stopBrokers(remoteBroker);
    });

    let ipcBusClient;
    it(`start client ${busPath}`, async () => {
      ipcBusClient = ipcBusModule.CreateIpcBusClient(ipcBusPath);
      return ipcBusClient.connect({ peerName: 'client' })
    });
  });
}

test(false);
test(true);
test(false, brokersLifeCycle.localBusPath);
test(true, brokersLifeCycle.localBusPath);
