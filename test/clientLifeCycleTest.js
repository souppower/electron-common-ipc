const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const ipcBusModule = require('../lib/electron-common-ipc');
const electronApp = require('electron').app;
const brokersLifeCycle = require('./brokersLifeCycle');


describe('Client', () => {
  before(async () => {
    return brokersLifeCycle.startBrokers();
  });

  after(async () => {
    return brokersLifeCycle.stopBrokers();
  });

  let ipcBusClient;
  it('start client', async () => {
    ipcBusClient = ipcBusModule.CreateIpcBusClient(brokersLifeCycle.ipcBusPath);
    return ipcBusClient.connect({ peerName: 'client' })
  });

  it('stop client', async () => {
    return ipcBusClient.close();
  });

});

