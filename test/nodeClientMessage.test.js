const chai = require('chai');
const child_process = require('child_process');
const assert = chai.assert;
const expect = chai.expect;
const path = require('path');
const minimist = require('minimist');

const ipcBusModule = require('../lib/electron-common-ipc');
const brokersLifeCycle = require('./brokers/brokersLifeCycle');

let timeoutDelay = brokersLifeCycle.timeoutDelay;

function test(remoteBroker, busPath) {

  let nodeChildProcess;

  function onClose(code, signal) {
    console.info(`onClose, [pid:${nodeChildProcess.pid}], code: ${code}, signal: ${signal}.`);
  }

  function onDisconnect() {
    console.info(`onDisconnect, [pid:${nodeChildProcess.pid}].`);
  }

  function onError(error) {
    console.error(`onError, [pid:${nodeChildProcess.pid}], error: ${JSON.stringify(error)}.`);
    if (nodeChildProcess._state === State.Initializing) {
    }
  }

  function onExit(code, signal) {
    console.info(`onExit, [pid:${nodeChildProcess.pid}], code: ${code}, signal: ${signal}.`);
  }

  function onStdOutData(data) {
    data = data ? data.toString() : '';
    console.log(`onStdOutData, [pid:${nodeChildProcess.pid}], data: ${data.toString()}.`);
  }

  function onStdOutEnd(data) {
    data = data ? data.toString() : '';
    console.log(`onStdOutEnd, [pid:${nodeChildProcess.pid}], data: ${data.toString()}.`);
  }

  function onStdErrData(data) {
    data = data ? data.toString() : '';
    console.error(`onStdErrData, [pid:${nodeChildProcess.pid}], data: ${data.toString()}.`);
  }

  function onStdErrEnd(data) {
    data = data ? data.toString() : '';
    console.error(`onStdErrEnd, [pid:${nodeChildProcess.pid}], data: ${data.toString()}.`);
  }

  describe(`Node Client messages ${remoteBroker ? '(Broker in remote)' : ''}`, () => {
    let ipcClient1;
    before(() => {
      return brokersLifeCycle.startBrokers(remoteBroker, busPath)
        .then((ipcBusPath) => {
          ipcClient1 = ipcBusModule.CreateIpcBusClient();
          return Promise.all([ipcClient1.connect(ipcBusPath, { peerName: 'client1', timeoutDelay })])
            .then(() => {
              return new Promise((resolve, reject) => {
                let options = { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] };
                // nodeChildProcess = child_process.fork(path.join(__dirname, 'nodeClient.js'), ['--inspect-brk=9229', `--busPath=${ipcBusPath}`], options);
                nodeChildProcess = child_process.fork(path.join(__dirname, 'nodeClient.js'), [
                  '--inspect-brk=9229', 
                  `--busPath=${ipcBusPath}`, 
                  `--busTimeout=${timeoutDelay}`
                ], 
                options);
                nodeChildProcess.addListener('close', onClose);
                nodeChildProcess.addListener('disconnect', onDisconnect);
                nodeChildProcess.addListener('error', onError);
                nodeChildProcess.addListener('exit', onExit);
                // nodeChildProcess.stdout.addListener('data', onStdOutData);
                // nodeChildProcess.stdout.addListener('end', onStdOutEnd);
                nodeChildProcess.stderr.addListener('data', onStdErrData);
                nodeChildProcess.stderr.addListener('end', onStdErrEnd);
                nodeChildProcess.addListener('message', (rawmessage, sendHandle) => {
                  const message = JSON.parse(rawmessage);
                  console.log(`ProcessHost, onChildMessage, [pid:${nodeChildProcess.pid}], ${JSON.stringify(message)}.`);
                  if (message.resolve) {
                    resolve();
                  }
                  if (message.reject) {
                    reject(message.error);
                  }
                });
              });
            });
        })
    });

    after(() => {
      return Promise.all([ipcClient1.close({ timeoutDelay })])
        .then(() => {
          nodeChildProcess.kill('SIGTERM');
          return brokersLifeCycle.stopBrokers(remoteBroker);
        });
    });

    it('test', (done) => {
      done();
    });

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


      function testSerialization(param, comparator) {
        {
          let msg = `message with a type ${typeof param} = ${JSON.stringify(param).substr(0, 128)}`;
          it(msg, (done) => {
            nodeChildProcess.removeAllListeners('message');
            nodeChildProcess.on('message', (rawmessage, sendHandle) => {
              console.timeEnd(msg);
              const message = JSON.parse(rawmessage, (key, value) => {
                return value && value.type === 'Buffer' ? Buffer.from(value.data) :value;
              });
              assert(comparator(message.args[0], param));
              done();
            });
            console.time(msg);
            ipcClient1.send('test-message', param);
          });
        }
        {
          let msg = `request with a type ${typeof param} = ${JSON.stringify(param).substr(0, 128)}`;
          it(msg, (done) => {
            // ipcClient2.removeAllListeners('test-request');
            // ipcClient2.on('test-request', (event, ...args) => {
            //   if (event.request) {
            //     event.request.resolve(args[0]);
            //   }
            // });
            console.time(msg);
            ipcClient1.request('test-request', 2000, param)
              .then((result) => {
                console.timeEnd(msg);
                assert(comparator(result.payload, param));
                done();
              })
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

// test(false);
// test(true);