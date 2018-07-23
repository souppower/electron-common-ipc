const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const ipcBusModule = require('../lib/electron-common-ipc');
const electronApp = require('electron').app;
const brokersLifeCycle = require('./helpers/brokersLifeCycle');

function test(remoteBroker) {
  describe(`Client ${remoteBroker ? '(Broker in remote)' : ''}`, () => {
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
    it('start client', async () => {
      ipcBusClient = ipcBusModule.CreateIpcBusClient(ipcBusPath);
      return ipcBusClient.connect({ peerName: 'client' })
    });

    it('stop client', async () => {
      return ipcBusClient.close();
    });

  });

  describe(`Client without closing it ${remoteBroker ? '(Broker in remote)' : ''}`, () => {
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
    it('start client', async () => {
      ipcBusClient = ipcBusModule.CreateIpcBusClient(ipcBusPath);
      return ipcBusClient.connect({ peerName: 'client' })
    });
  });
}

test(false);
test(true);