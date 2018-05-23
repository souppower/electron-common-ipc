const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const ipcBusModule = require('../lib/electron-common-ipc');
const electronApp = require('electron').app;
const brokersLifeCycle = require('./brokersLifeCycle');


let ipcBusClient1;
let ipcBusClient2;
function startClients() {
  const ipcBusClient1 = ipcBusModule.CreateIpcBusClient(brokersLifeCycle.ipcBusPath);
  const ipcBusClient2 = ipcBusModule.CreateIpcBusClient(brokersLifeCycle.ipcBusPath);
  return Promise.all([ipcBusClient1.connect({ peerName: 'client1' }), ipcBusClient2.connect({ peerName: 'client2' })]);
}

function stopClients() {
  return Promise.all([ipcBusClient1.close(), ipcBusClient2.close()]);
}

describe('Client', () => {
  before((done) => {
    brokersLifeCycle.startBrokers()
      .then(() => {
        done();
      })
      .catch((err) => {
        done(err);
      });
  });

  after((done) => {
    brokersLifeCycle.stopBrokers()
      .then(() => {
        done();
      })
      .catch((err) => {
        done(err);
      });
  });

  // it('start client', (done) => {
  //   // Create clients
  //   const ipcBusClient1 = ipcBusModule.CreateIpcBusClient(brokersLifeCycle.ipcBusPath);
  //   const ipcBusClient2 = ipcBusModule.CreateIpcBusClient(brokersLifeCycle.ipcBusPath);
  //   Promise.all([ipcBusClient1.connect({ peerName: 'client1' }), ipcBusClient2.connect({ peerName: 'client2' })])
  //     .then((msg) => {
  //       // Chatting on channel 'greeting'
  //       ipcBusClient1.addListener('greeting', (ipcBusEvent, greetingMsg) => {
  //         if (ipcBusEvent.request) {
  //           ipcBusEvent.request.resolve('thanks to you, dear #' + ipcBusEvent.sender.name);
  //         }
  //         else {
  //           ipcBusClient1.send('greeting-reply', 'thanks to all listeners')
  //         }
  //         console.log(ipcBusClient1.peer.name + ' received ' + ipcBusEvent.channel + ':' + greetingMsg);
  //       });

  //       ipcBusClient2.addListener('greeting', (ipcBusEvent, greetingMsg) => {
  //         if (ipcBusEvent.request) {
  //           ipcBusEvent.request.resolve('thanks to you, dear #' + ipcBusEvent.sender.name);
  //         }
  //         else {
  //           ipcBusClient2.send('greeting-reply', 'thanks to all listeners')
  //         }
  //         console.log(ipcBusClient2.peer.name + ' received ' + ipcBusEvent.channel + ':' + greetingMsg);
  //       });

  //       ipcBusClient1.addListener('greeting-reply', (ipcBusEvent, greetingReplyMsg) => {
  //         console.log(greetingReplyMsg);
  //         console.log(ipcBusClient1.peer.name + ' received ' + ipcBusEvent.channel + ':' + greetingReplyMsg);
  //       });

  //       ipcBusClient2.send('greeting', 'hello everyone!');

  //       ipcBusClient2.request('greeting', 0, 'hello partner!')
  //         .then((ipcBusRequestResponse) => {
  //           console.log(JSON.stringify(ipcBusRequestResponse.event.sender) + ' replied ' + ipcBusRequestResponse.payload);
  //         })
  //         .catch((err) => {
  //           console.log('I have no friend :-(');
  //         });


  //       ipcBusClient1.send('greeting', 'hello everyone!');
  //       ipcBusClient1.request('greeting', 1000, 'hello partner, please answer within 1sec!')
  //         .then((ipcBusRequestResponse) => {
  //           console.log(JSON.stringify(ipcBusRequestResponse.event.sender) + ' replied ' + ipcBusRequestResponse.payload);
  //         })
  //         .catch((err) => {
  //           console.log('I have no friend :-(');
  //         });
  //     });
  // });
});

