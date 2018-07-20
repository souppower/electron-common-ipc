const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const ipcBusModule = require('../lib/electron-common-ipc');
const brokersLifeCycle = require('./brokersLifeCycle');

describe('Wildcard channel', () => {
  let ipcClient1;
  let ipcClient2;
  before(() => {
    return brokersLifeCycle.startBrokers()
      .then((ipcBusPath) => {
        ipcClient1 = ipcBusModule.CreateIpcBusClient(ipcBusPath);
        ipcClient2 = ipcBusModule.CreateIpcBusClient(ipcBusPath);
        return Promise.all([ipcClient1.connect({ peerName: 'client1' }), ipcClient2.connect({ peerName: 'client2' })])
      })
  });

  after(() => {
    return Promise.all([ipcClient1.close(), ipcClient2.close()])
      .then(() => {
        return brokersLifeCycle.stopBrokers();
      });
  });

  const channel1 = 'something';
  it(`Listenen 'some*' channel`, (done) => {
    ipcClient1.on('some*', (event, ...args) => {
      if (event.channel === channel1) {
        done();
      }
      else {
        done('not good');
      }
    });
    ipcClient2.send(channel1, 'good');
  });
})