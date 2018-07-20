const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const ipcBusModule = require('../lib/electron-common-ipc');
const brokersLifeCycle = require('./brokersLifeCycle');

describe('Wildcard channel', () => {
  let ipcBusPath;

  before(() => {
    return brokersLifeCycle.startBrokers()
    .then((alllocatedIpcBusPath) => {
      ipcBusPath = alllocatedIpcBusPath;
    });
  });

  after(() => {
    return brokersLifeCycle.stopBrokers();
  });

  let ipcClient1;
  let ipcClient2;
  beforeEach(() => {
      ipcClient1 = ipcBusModule.CreateIpcBusClient(ipcBusPath);
      ipcClient2 = ipcBusModule.CreateIpcBusClient(ipcBusPath);
      return Promise.all([ipcClient1.connect({ peerName: 'client1' }), ipcClient2.connect({ peerName: 'client2' })])
  });

  afterEach(() => {
    return Promise.all([ipcClient1.close(), ipcClient2.close()]);
  });

  const channel1 = 'something';
  it(`Listen 'some*' channel`, (done) => {
    ipcClient1.on('some*', (event, ...args) => {
      console.log(`some*`);
      if (event.channel === channel1) {
        done();
      }
      else {
        done('not good');
      }
    });
    ipcClient2.send(channel1, 'good');
  });

  it(`Listen 'some*' and 'something' channels`, (done) => {
    let getSome = false;
    let getSomething = false;
    ipcClient1.on('some*', (event, ...args) => {
      console.log(`some*`);
      if (event.channel === channel1) {
        getSome = true;
        if (getSomething) {
          done();
        }
      }
      else {
        done('not good');
      }
    });
    ipcClient1.on(channel1, (event, ...args) => {
      console.log(channel1);
      if (event.channel === channel1) {
        getSomething = true;
        if (getSome) {
          done();
        }
      }
      else {
        done('not good');
      }
    });
    ipcClient2.send(channel1, 'good');
  });
})