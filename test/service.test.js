const chai = require('chai');
const assert = chai.assert;
const expect = require('expect');
const EventEmitter = require('events');
const util = require('util');

const ipcBusModule = require('../lib/electron-common-ipc');
const brokersLifeCycle = require('./brokers/brokersLifeCycle');


function TestService() {
  EventEmitter.call(this);
  this.getArg0 = function () {
    console.log(`Service.getArg0() is called`);
    return 0;
  }
  this.getArg1 = function (arg1) {
    console.log(`Service.getArg1(${arg1}) is called`);
    return arg1;
  }
  this.getArg2 = function (arg1, arg2) {
    console.log(`Service.getArg2(${arg1}, ${arg2}) is called`);
    return { arg1, arg2 };
  }
  this.triggerEvent = function () {
    this.emit('MyEvent');
  }
}
util.inherits(TestService, EventEmitter);


function TestService2() {
  TestService.call(this);
  this.getArg3 = function (arg1, arg2, arg3) {
    console.log(`Service2.getArg3(${arg1}, ${arg2}, ${arg3}) is called`);
    return { arg1, arg2, arg3 };
  }
}
util.inherits(TestService2, TestService);


const delayService = 500;

function test(remoteBroker, factory) {

  describe(`Service ${remoteBroker ? '(Broker in remote)' : ''}`, () => {
    let ipcBusPath;
    let ipcBusClient;

    before(() => {
      return brokersLifeCycle.startBrokers(remoteBroker)
        .then((port) => {
          ipcBusPath = port;
        })
        .then(() => {
          ipcBusClient = ipcBusModule.CreateIpcBusClient(ipcBusPath);
          return ipcBusClient.connect({ peerName: 'client' });
        });
    });

    after(() => {
      return brokersLifeCycle.stopBrokers(remoteBroker);
    });

    describe('Creation', () => {
      it('connect service first', () => {
        const testServiceName = 'test-service1';

        const testServiceInstance = factory();
        const testService = ipcBusModule.CreateIpcBusService(ipcBusClient, testServiceName, testServiceInstance);
        testService.start();

        // Create the proxy (client-side)
        const testServiceProxy = ipcBusModule.CreateIpcBusServiceProxy(ipcBusClient, testServiceName);
        return testServiceProxy.connect();
      });

      it(`connect proxy first (delay ${delayService} service creation)`, (done) => {
        const testServiceName = 'test-service2';

        // Create the proxy (client-side)
        const testServiceProxy = ipcBusModule.CreateIpcBusServiceProxy(ipcBusClient, testServiceName);
        testServiceProxy.connect()
          .then(() => {
            done();
          });

        // delay the start
        setTimeout(() => {
          const testServiceInstance = factory();
          const testService = ipcBusModule.CreateIpcBusService(ipcBusClient, testServiceName, testServiceInstance);
          testService.start();
        }, delayService);
      });
    });

    describe('Call', () => {
      const testServiceName = 'test-service3';
      let testServiceProxy;
      let testServiceInstance = factory();
      before(() => {
        const testService = ipcBusModule.CreateIpcBusService(ipcBusClient, testServiceName, testServiceInstance);
        testService.start();

        // Create the proxy (client-side)
        testServiceProxy = ipcBusModule.CreateIpcBusServiceProxy(ipcBusClient, testServiceName);
        return testServiceProxy.connect();
      });

      it('getArg0', () => {
        testServiceProxy.getWrapper().getArg0()
          .then((value) => {
            expect(value).toEqual(0);
          });
      });

      it('getArg1 - number', () => {
        testServiceProxy.getWrapper().getArg1(1)
          .then((value) => {
            expect(value).toEqual(1);
          });
      });

      it('getArg1 - string', () => {
        testServiceProxy.getWrapper().getArg1('string')
          .then((value) => {
            expect(value).toEqual('string');
          });
      });

      it('getArg2', () => {
        testServiceProxy.getWrapper().getArg2(1, 'string')
          .then((value) => {
            expect(value.arg1).toEqual(1);
            expect(value.arg2).toEqual('string');
          });
      });

      if (testServiceInstance instanceof TestService2) {
        it('getArg3', () => {
          testServiceProxy.getWrapper().getArg3(1, 'string', { coucou: 'coucou' })
            .then((value) => {
              expect(value.arg1).toEqual(1);
              expect(value.arg2).toEqual('string');
              // expect(value.arg3).toEqual('string');
            });
        });
      }

      it('event', (done) => {
        testServiceProxy.getWrapper().on('MyEvent', () => {
          done();
        });
        testServiceInstance.triggerEvent();
      });
    });

    describe('Call delayed', () => {
      const testServiceName = 'test-service4';
      let testServiceProxy;
      let testServiceInstance = factory();;
      before(() => {
        // Create the proxy (client-side)
        testServiceProxy = ipcBusModule.CreateIpcBusServiceProxy(ipcBusClient, testServiceName);
        testServiceProxy.connect();

        // delay the start
        setTimeout(() => {
          const testService = ipcBusModule.CreateIpcBusService(ipcBusClient, testServiceName, testServiceInstance);
          testService.start();
        }, delayService);
      });

      after(() => {
        return testServiceProxy.connect();
      })

      it('getArg0', () => {
        testServiceProxy.call('getArg0')
          .then((value) => {
            expect(value).toEqual(0);
          });
      });

      it('getArg1 - number', () => {
        testServiceProxy.call('getArg1', 1)
          .then((value) => {
            expect(value).toEqual(1);
          });
      });

      it('getArg1 - string', () => {
        testServiceProxy.call('getArg1', 'string')
          .then((value) => {
            expect(value).toEqual('string');
          });
      });

      it('getArg2', () => {
        testServiceProxy.call('getArg2', 1, 'string')
          .then((value) => {
            expect(value.arg1).toEqual(1);
            expect(value.arg2).toEqual('string');
          });
      });

      if (testServiceInstance instanceof TestService2) {
        it('getArg3', () => {
          testServiceProxy.call('getArg3', 1, 'string', { coucou: 'coucou' })
            .then((value) => {
              expect(value.arg1).toEqual(1);
              expect(value.arg2).toEqual('string');
              // expect(value.arg3).toEqual('string');
            });
        });
      }
    });
  });
}

test(false, () => new TestService());
test(true, () => new TestService());

test(false, () => new TestService2());
test(true, () => new TestService2());