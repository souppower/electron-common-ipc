const { EventEmitter } = require('events');
const minimist = require('minimist');
const ipcBusModule = require('../../lib/electron-common-ipc');

console.log(`Node Broker instance: start`);

let args = minimist(process.argv.slice(1));
let timeoutDelay = 2000;
if (args.busTimeout) {
    timeoutDelay = parseInt(args.busTimeout);
}
let ipcBusPath = 0;
if (args.busPath) {
    ipcBusPath = parseInt(args.busPath);
}

// Create broker
let ipcBusBroker = ipcBusModule.CreateIpcBusBroker(ipcBusPath);
// Start broker
console.log('Remote IpcBusBroker starting...');
ipcBusBroker.start()
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
                return ipcBusBroker.stop();
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
            process.exit(0);
        });
    }
});

process.on('exit', (message) => {
    console.log(`Node Broker instance: exit`);
    // If the process exit suddently, try to close brokers anyway.
    if (ipcBusBroker) {
        console.log('Remote IpcBusBroker emergency stop');
        ipcBusBroker.stop();
        ipcBusBroker = null;
    }
});
