const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const ipcBusModule = require('../lib/electron-common-ipc');
const brokersLifeCycle = require('./helpers/brokersLifeCycle');

function test(remoteBroker) {

  describe(`Wildcard channel`, () => {
    let ipcBusPath;

    before(() => {
      return brokersLifeCycle.startBrokers(remoteBroker)
        .then((alllocatedIpcBusPath) => {
          ipcBusPath = alllocatedIpcBusPath;
        });
    });

    after(() => {
      return brokersLifeCycle.stopBrokers(remoteBroker);
    });

    let ipcClient1;
    let ipcClient2;
    beforeEach(() => {
      console.log(`IpcBusClient/s starting...`);
      ipcClient1 = ipcBusModule.CreateIpcBusClient(ipcBusPath);
      ipcClient2 = ipcBusModule.CreateIpcBusClient(ipcBusPath);
      return Promise.all([ipcClient1.connect({ peerName: 'client1' }), ipcClient2.connect({ peerName: 'client2' })])
        .then(() => {
          console.log(`IpcBusClient/s started`);
        });
    });

    afterEach(() => {
      console.log(`IpcBusClient/s closing...`);
      return Promise.all([ipcClient1.close(), ipcClient2.close()])
        .then(() => {
          console.log(`IpcBusClient/s closed`);
        });
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
      // done();
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
      // done();
    });
  })
}
test(false);
test(true);