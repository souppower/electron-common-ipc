const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const ipcBusModule = require('../lib/electron-common-ipc');
// ipcBusModule.ActivateIpcBusTrace(true);

const brokersLifeCycle = require('./brokers/brokersLifeCycle');

let timeoutDelay = brokersLifeCycle.timeoutDelay;

function Equal(a1, a2) {
  return (a1 === a2);
}

function ArrayEqual(a1, a2) {
  return (a1.length === a2.length) && (a1.join(':') === a2.join(':'));
}

function ObjectEqual(a1, a2) {
  return JSON.stringify(a1) === JSON.stringify(a2);
}

function BufferEqual(a1, a2) {
  return Buffer.compare(a1, a2) === 0;
}

function test(remoteBroker, busPath) {

  describe(`Master Client ${busPath} messages ${remoteBroker ? '(Broker in remote)' : ''}`, () => {
    let ipcClient1;
    let ipcClient2;
    let brokers;
    before(() => {
      brokers = new brokersLifeCycle.Brokers(remoteBroker, busPath);
      return brokers.start()
        .then(() => {
          let ipcBusPath = brokers.getBusPath();
          ipcClient1 = ipcBusModule.CreateIpcBusClient();
          ipcClient2 = ipcBusModule.CreateIpcBusClient();
          return Promise.all([ipcClient1.connect(ipcBusPath, { peerName: 'client1', timeoutDelay }), ipcClient2.connect(ipcBusPath, { peerName: 'client2', timeoutDelay })]);
        })
    });

    after(() => {
      return Promise.all([ipcClient1.close({ timeoutDelay }), ipcClient2.close({ timeoutDelay })])
        .then(() => {
          return brokers.stop();
        })
        .catch(() => { });
    });

    function testSerialization(param, comparator) {
      {
        // let msg = `message with a type ${typeof param} = ${JSON.stringify(param).substr(0, 128)}`;
        let msg = `message with a type ${typeof param}`;
        it(msg, (done) => {
          ipcClient2.removeAllListeners('test-message');
          ipcClient2.on('test-message', (event, ...args) => {
            console.timeEnd(msg);
            assert(comparator(args[0], param));
            done();
          });
          // We have to wait a bit for having broker aware of the new listener
          setTimeout(() => {
            console.time(msg);
            ipcClient1.send('test-message', param);
          }, 200);
        });
      }
      {
        // let msg = `request with a type ${typeof param} = ${JSON.stringify(param).substr(0, 128)}`;
        let msg = `request with a type ${typeof param}`;
        it(msg, (done) => {
          ipcClient2.removeAllListeners('test-request');
          ipcClient2.on('test-request', (event, ...args) => {
            if (event.request) {
              event.request.resolve(args[0]);
            }
          });
          // We have to wait a bit for having broker aware of the new listener
          setTimeout(() => {
            console.time(msg);
            ipcClient1.request('test-request', 2000, param)
              .then((result) => {
                console.timeEnd(msg);
                assert(comparator(result.payload, param));
                done();
              })
          }, 200);
        });
      }
    }

    describe('Boolean', (done) => {
      const paramTrue = true;
      const paramFalse = false;

      describe('serialize true', () => {
        testSerialization(paramTrue, Equal);
      });
      describe('serialize false', () => {
        testSerialization(paramFalse, Equal);
      });
    });

    describe('Number', () => {
      const paramDouble = 12302.23;
      const paramInt32Positive = 45698;
      const paramInt32Negative = -45698;
      const paramInt64Positive = 99999999999999;
      const paramInt64Negative = -99999999999999;

      describe('serialize double', () => {
        testSerialization(paramDouble, Equal);
      });
      describe('serialize 32bits positive integer', () => {
        testSerialization(paramInt32Positive, Equal);
      });
      describe('serialize 32bits negative integer', () => {
        testSerialization(paramInt32Negative, Equal);
      });
      describe('serialize 64bits positive integer', () => {
        testSerialization(paramInt64Positive, Equal);
      });
      describe('serialize 64bits negative integer', () => {
        testSerialization(paramInt64Negative, Equal);
      });
    });

    describe('String', () => {
      function allocateString(seed, num) {
        num = Number(num) / 100;
        var result = seed;
        var str = '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789';
        while (true) {
          if (num & 1) { // (1)
            result += str;
          }
          num >>>= 1; // (2)
          if (num <= 0) break;
          str += str;
        }
        return result;
      }

      let longstring = allocateString('long string', Math.pow(2, 12));
      let shortstring = 'hello';
      let emptystring = '';

      describe('long string', () => {
        testSerialization(longstring, Equal);
      });

      describe('short string', () => {
        testSerialization(shortstring, Equal);
      });

      describe('empty string', () => {
        testSerialization(emptystring, Equal);
      });
    });

    describe('Array', () => {
      const paramArray = ['this is a test', 255, 56.5, true, ''];
      testSerialization(paramArray, ArrayEqual);
    });


    describe('Buffer', () => {
      const paramBuffer = Buffer.alloc(128);
      for (let i = 0; i < paramBuffer.length; ++i) {
        paramBuffer[i] = 255 * Math.random();
      }
      testSerialization(paramBuffer, BufferEqual);
    });

    describe('Object', () => {
      const paramObject = {
        num: 10.2,
        str: "test",
        bool: true,
        Null: null,
        Undef: undefined,
        properties: {
          num1: 12.2,
          str1: "test2",
          bool1: false
        }
      };

      describe('serialize', () => {
        testSerialization(paramObject, ObjectEqual);
      });

      const nullObject = null;
      describe('serialize null', () => {
        testSerialization(nullObject, ObjectEqual);
      });
    });
  })
}

test(false);
test(true);
test(false, brokersLifeCycle.getLocalBusPath());
test(true, brokersLifeCycle.getLocalBusPath());
