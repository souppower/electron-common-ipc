const chai = require('chai');
const assert = chai.assert;
const expect = require('expect');
const EventEmitter = require('events');
const util = require('util');

const ipcBusModule = require('../lib/electron-common-ipc');
// ipcBusModule.ActivateIpcBusTrace(true);
// ipcBusModule.ActivateServiceTrace(true);

const brokersLifeCycle = require('./brokers/brokersLifeCycle');
let timeoutDelay = brokersLifeCycle.timeoutDelay;


function TestService() {
  EventEmitter.call(this);
  this.getArg0 = function () {
    console.log(`Service1.getArg0() is called`);
    return 0;
  }
  this.getArg1 = function (arg1) {
    console.log(`Service1.getArg1(${arg1}) is called`);
    return arg1;
  }
  this.getArg2 = function (arg1, arg2) {
    console.log(`Service1.getArg2(${arg1}, ${arg2}) is called`);
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


function TestService3() {
  this.getArg0 = function () {
    console.log(`Service3.getArg0() is called`);
    return 0;
  }
  this.getArg1 = function (arg1) {
    console.log(`Service3.getArg1(${arg1}) is called`);
    return arg1;
  }
  this.getArg2 = function (arg1, arg2) {
    console.log(`Service3.getArg2(${arg1}, ${arg2}) is called`);
    return { arg1, arg2 };
  }
}


const delayService = 2000;

function test(remoteBroker, busPath, factory) {

  describe(`Service ${remoteBroker ? '(Broker in remote)' : ''}`, () => {
    let ipcBusPath;
    let ipcBusClient;
    let brokers;

    before(() => {
      brokers = new brokersLifeCycle.Brokers(remoteBroker, busPath);
      return brokers.start()
        .then(() => {
          let ipcBusPath = brokers.getBusPath();
          ipcBusClient = ipcBusModule.CreateIpcBusClient();
          return ipcBusClient.connect(ipcBusPath, { peerName: 'client' });
        });
    });

    after(() => {
      return Promise.all([ipcBusClient.close()])
        .then(() => {
          return brokers.stop();
        })
        .catch(() => { });
    });

    describe('Creation', () => {
      it('connect service stub first', () => {
        const testServiceName = 'test-service-creation';

        const testServiceInstance = factory();
        const testService = ipcBusModule.CreateIpcBusService(ipcBusClient, testServiceName, testServiceInstance);
        testService.start();

        // Create the proxy (client-side)
        const testServiceProxy = ipcBusModule.CreateIpcBusServiceProxy(ipcBusClient, testServiceName);
        return testServiceProxy.connect();
      });

      it('start service stub first and proxy later (event)', (done) => {
        const testServiceName = 'test-service-connect-event';

        const testServiceInstance = factory();
        const testService = ipcBusModule.CreateIpcBusService(ipcBusClient, testServiceName, testServiceInstance);
        testService.start();

        // Create the proxy (client-side)
        const testServiceProxy = ipcBusModule.CreateIpcBusServiceProxy(ipcBusClient, testServiceName);
        if (testServiceProxy.isStarted) {
          done();
        }
        else {
          testServiceProxy.on(ipcBusModule.IPCBUS_SERVICE_EVENT_START, () => {
            done();
          })
        }
      });

      it('start service stub first and proxy later (function)', (done) => {
        const testServiceName = 'test-service-connect-method';

        const testServiceInstance = factory();
        const testService = ipcBusModule.CreateIpcBusService(ipcBusClient, testServiceName, testServiceInstance);
        testService.start();

        // Create the proxy (client-side)
        const testServiceProxy = ipcBusModule.CreateIpcBusServiceProxy(ipcBusClient, testServiceName);
        testServiceProxy.connect()
        .then(() => {
          done();
        });
      });

      it(`start proxy first, delay ${delayService}ms stub service creation (event)`, (done) => {
        const testServiceName = 'test-service-late-connect-event';

        // Create the proxy (client-side)
        const testServiceProxy = ipcBusModule.CreateIpcBusServiceProxy(ipcBusClient, testServiceName, { timeoutDelay: delayService + 100 });
        if (testServiceProxy.isStarted) {
          done();
        }
        else {
          testServiceProxy.on(ipcBusModule.IPCBUS_SERVICE_EVENT_START, () => {
            done();
          })
        }

        // delay the start
        setTimeout(() => {
          const testServiceInstance = factory();
          const testService = ipcBusModule.CreateIpcBusService(ipcBusClient, testServiceName, testServiceInstance);
          testService.start();
        }, delayService);
      });

      it(`connect proxy first (delay ${delayService}ms service creation) (function)`, (done) => {
        const testServiceName = 'test-service-late-connect-function';

        // Create the proxy (client-side)
        const testServiceProxy = ipcBusModule.CreateIpcBusServiceProxy(ipcBusClient, testServiceName, { timeoutDelay: delayService + 100 });
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
      const testServiceName = 'test-service-call';
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

      if (!testServiceInstance instanceof TestService3) {
        it('event', (done) => {
          testServiceProxy.getWrapper().on('MyEvent', () => {
            done();
          });
          testServiceInstance.triggerEvent();
        });
      }
    });

    describe('Call delayed', () => {
      const testServiceName = 'test-service-call-delayed';
      let testServiceProxy;
      let testServiceInstance = factory();;
      before(() => {
        // Create the proxy (client-side)
        testServiceProxy = ipcBusModule.CreateIpcBusServiceProxy(ipcBusClient, testServiceName, { timeoutDelay: delayService + 100 });
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

      it('FunctionUnknown', () => {
        testServiceProxy.call('FunctionUnknown', 1, 'string')
          .then((value) => {
            throw 'Should not be resolved !!';
          })
          .catch((err) => {
            console.log(err);
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

test(false, undefined, () => new TestService());
test(true, undefined, () => new TestService());

test(false, undefined, () => new TestService2());
test(true, undefined, () => new TestService2());

test(false, undefined, () => new TestService3());
test(true, undefined, () => new TestService3());