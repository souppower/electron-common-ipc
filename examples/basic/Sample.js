// Load modules
const ipcBusModule = require("electron-ipc-bus");
const electronApp = require('electron').app;

// Configuration
const ipcBusPath = 50494;
// const ipcBusPath = '/myfavorite/path';

// Startup
electronApp.on('ready', function () {
    // Create broker
    const ipcBusBroker = ipcBusModule.CreateIpcBusBroker(ipcBusPath);
    // Start broker
    ipcBusBroker.start()
        .then((msg) => {
            console.log('IpcBusBroker started');

            // Create bridge
            const ipcBusBridge = ipcBusModule.CreateIpcBusBridge(ipcBusPath);
            // Start bridge
            ipcBusBridge.start()
                .then((msg) => {
                    console.log('IpcBusBridge started');

                    // Create clients
                    const ipcBusClient1 = ipcBusModule.CreateIpcBusClient(ipcBusPath);
                    const ipcBusClient2 = ipcBusModule.CreateIpcBusClient(ipcBusPath);
                    Promise.all([ipcBusClient1.connect({ peerName: 'client1' }), ipcBusClient2.connect({ peerName: 'client2' })])
                        .then((msg) => {
                            // Chatting on channel 'greeting'
                            ipcBusClient1.addListener('greeting', (ipcBusEvent, greetingMsg) => {
                                if (ipcBusEvent.request) {
                                    ipcBusEvent.request.resolve('thanks to you, dear #' + ipcBusEvent.sender.name);
                                }
                                else {
                                    ipcBusClient1.send('greeting-reply', 'thanks to all listeners')
                                }
                                console.log(ipcBusClient1.peer.name + ' received ' + ipcBusEvent.channel + ':' + greetingMsg);
                            });

                            ipcBusClient2.addListener('greeting', (ipcBusEvent, greetingMsg) => {
                                if (ipcBusEvent.request) {
                                    ipcBusEvent.request.resolve('thanks to you, dear #' + ipcBusEvent.sender.name);
                                }
                                else {
                                    ipcBusClient2.send('greeting-reply', 'thanks to all listeners')
                                }
                                console.log(ipcBusClient2.peer.name + ' received ' + ipcBusEvent.channel + ':' + greetingMsg);
                            });

                            ipcBusClient1.addListener('greeting-reply', (ipcBusEvent, greetingReplyMsg) => {
                                console.log(greetingReplyMsg);
                                console.log(ipcBusClient1.peer.name + ' received ' + ipcBusEvent.channel + ':' + greetingReplyMsg);
                            });

                            ipcBusClient2.send('greeting', 'hello everyone!');

                            ipcBusClient2.request('greeting', 0, 'hello partner!')
                                .then((ipcBusRequestResponse) => {
                                    console.log(JSON.stringify(ipcBusRequestResponse.event.sender) + ' replied ' + ipcBusRequestResponse.payload);
                                })
                                .catch((err) => {
                                    console.log('I have no friend :-(');
                                });

                            ipcBusClient1.request('greeting', 1000, 'hello partner, please answer within 1sec!')
                                .then((ipcBusRequestResponse) => {
                                    console.log(JSON.stringify(ipcBusRequestResponse.event.sender) + ' replied ' + ipcBusRequestResponse.payload);
                                })
                                .catch((err) => {
                                    console.log('I have no friend :-(');
                                });
                        });
                });
        });
});