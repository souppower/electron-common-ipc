const minimist = require('minimist');
const ipcBusModule = require('electron-common-ipc');

console.log(process.argv);

const args = minimist(process.argv.slice(1));
let busTimeout = 30000;
if (args.busTimeout) {
    busTimeout = parseInt(args.busTimeout);
}
let busPath = 0;
if (args.busPath) {
    busPath = parseInt(args.busPath);
}

const ipcClient = ipcBusModule.IpcBusClient.Create();
ipcClient.connect(busPath, { peerName: 'client Node', timeoutDelay: busTimeout })
.then(() => {
    ipcClient.on('client Node ACK', (event) => {
        if (event.request) {
            event.request.resolve('ACK');
        }
    });
    process.send(JSON.stringify({ ready: { resolve: true }}));
})
.catch((err) => {
    process.send(JSON.stringify({ ready: { reject: true, error: err }}));
});

// Keep process alive
process.stdin.on("data", () => {});