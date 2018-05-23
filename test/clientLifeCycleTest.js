const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const ipcBusModule = require('../lib/electron-common-ipc');
const electronApp = require('electron').app;
const brokersLifeCycle = require('./brokersLifeCycle');


describe('Client', () => {
  let ipcBusPath;

  before(async () => {
    return brokersLifeCycle.startBrokers()
    .then((port) => {
      ipcBusPath = port;
    });
  });

  after(async () => {
    return brokersLifeCycle.stopBrokers();
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

describe('Client', () => {
  let ipcBusPath;

  before(async () => {
    return brokersLifeCycle.startBrokers()
    .then((port) => {
      ipcBusPath = port;
    });
  });

  after(async () => {
    return brokersLifeCycle.stopBrokers();
  });

  let ipcBusClient;
  it('start client', async () => {
    ipcBusClient = ipcBusModule.CreateIpcBusClient(ipcBusPath);
    return ipcBusClient.connect({ peerName: 'client' })
  });
});

