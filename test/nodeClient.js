// busPath
const argv = require('minimist')(process.argv.slice(2));
console.log(argv);

const ipcBusModule = require('../lib/electron-common-ipc');
const ipcClient = ipcBusModule.CreateIpcBusClient(argv.busPath);
ipcClient.connect({ peerName: 'client Node' })
    .then(() => {
        ipcClient.on('test-message', (event, ...args) => {
            console.log(`test-message event=${event}, args=${args}`);
            process.send(JSON.stringify({ event: event, args: args }));
        });
        ipcClient.on('test-request', (event, ...args) => {
            console.log(`test-request event=${event}, args=${args}`);
            if (event.request) {
                event.request.resolve(args[0]);
            }
        });
        process.send(JSON.stringify({ resolve: true }));
    })
    .catch((err) => {
        process.send(JSON.stringify({ reject: true, error: err }));
    });

