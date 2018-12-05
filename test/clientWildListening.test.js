const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const ipcBusModule = require('../lib/electron-common-ipc');
// ipcBusModule.ActivateIpcBusTrace(true);

const brokersLifeCycle = require('./brokers/brokersLifeCycle');
let timeoutDelay = brokersLifeCycle.timeoutDelay;

function test(remoteBroker, busPath) {

    describe(`Wildcard channel`, () => {
        let ipcClient1;
        let ipcClient2;
        let brokers;

        before(() => {
            brokers = new brokersLifeCycle.Brokers(remoteBroker, busPath);
            return brokers.start();
        });

        after(() => {
            return brokers.stop()
                .catch(() => { });
        });

        beforeEach(() => {
            let ipcBusPath = brokers.getBusPath();
            ipcClient1 = ipcBusModule.CreateIpcBusClient(ipcBusPath);
            ipcClient2 = ipcBusModule.CreateIpcBusClient(ipcBusPath);
            return Promise.all([ipcClient1.connect({ peerName: 'client1', timeoutDelay }), ipcClient2.connect({ peerName: 'client2', timeoutDelay })]);
        })

        afterEach(() => {
            console.log(`IpcBusClient/s closing...`);
            return Promise.all([ipcClient1.close({ timeoutDelay }), ipcClient2.close({ timeoutDelay })])
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
            // We have to wait a bit for having broker aware of the new listener
            setTimeout(() => {
                ipcClient2.send(channel1, 'good');
            }, 200);
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
            // We have to wait a bit for having broker aware of the new listener
            setTimeout(() => {
                ipcClient2.send(channel1, 'good');
            }, 200);
        });
    })
}
test(false);
test(true);
test(false, brokersLifeCycle.getLocalBusPath());
test(true, brokersLifeCycle.getLocalBusPath());
