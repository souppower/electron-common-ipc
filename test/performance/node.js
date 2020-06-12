const minimist = require('minimist');

const { IpcClientTest } = require('./ipcClientTest.js');

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

const ipcClientTest = new IpcClientTest('client Node', busPath, busTimeout);
ipcClientTest.create()
.then(() => {
    process.send(JSON.stringify({ ready: { resolve: true }}));
})
.catch((err) => {
    process.send(JSON.stringify({ ready: { reject: true, error: err }}));
});

