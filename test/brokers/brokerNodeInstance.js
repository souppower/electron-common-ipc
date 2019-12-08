const { EventEmitter } = require('events');
const minimist = require('minimist');
const ipcBusModule = require('../../lib/electron-common-ipc');

console.log(`Node Broker instance: start`);

let args = minimist(process.argv.slice(1));
let timeoutDelay = 5000;
if (process.env['NODE_ENV'] === 'development') {
  timeoutDelay = 20000;
}
if (args.busTimeout) {
    timeoutDelay = parseInt(args.busTimeout);
}
let ipcBusPath = 0;
if (args.busPath) {
    ipcBusPath = args.busPath;
}

// Create broker
let ipcBusBroker = ipcBusModule.CreateIpcBusBroker();
// Start broker
console.log('Remote IpcBusBroker starting...');
ipcBusBroker.connect(ipcBusPath, { timeoutDelay })
 .then((msg) => {
    console.log('Remote IpcBusBroker started');
    process.send({ event: 'resolve'});
})
 .catch((err) => {
    console.log(`Remote IpcBusBroker started failed ${err}`);
    process.send(`reject`);
    process.exit(0);
 });

process.on('message', (message) => {
    if (message === 'term') {
        console.log('Remote IpcBusBroker stopping...');
        Promise.resolve()
        .then(() => {
            if (ipcBusBroker) {
                return ipcBusBroker.close({ timeoutDelay });
            }
            else {
                return Promise.resolve();
            }
        })
        .then(() => {
            console.log('Remote IpcBusBroker stopped');
            ipcBusBroker = null;
            process.exit(0);
        })
        .catch((err) => {
            console.log(`Remote IpcBusBroker stopped failed ${err}`);
            ipcBusBroker = null;
            process.exit(0);
        });
    }
});

process.on('exit', (message) => {
    console.log(`Node Broker instance: exit`);
    // If the process exit suddently, try to close brokers anyway.
    if (ipcBusBroker) {
        console.log('Remote IpcBusBroker emergency stop');
        ipcBusBroker.close();
        ipcBusBroker = null;
    }
});
