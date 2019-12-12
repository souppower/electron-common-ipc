const minimist = require('minimist');

// busPath
console.log(argv);

let args = minimist(process.argv.slice(1));
let timeoutDelay = 30000;
if (args.busTimeout) {
    timeoutDelay = parseInt(args.busTimeout);
}
let ipcBusPath = 0;
if (args.busPath) {
    ipcBusPath = parseInt(args.busPath);
}

const ipcBusModule = require('../lib/electron-common-ipc');
const ipcClient = ipcBusModule.CreateIpcBusClient();
ipcClient.connect(ipcBusPath, { peerName: 'client Node', timeoutDelay })
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

