const minimist = require('minimist');
const ipcBusModule = require('electron-common-ipc');

console.log(`Node client: start`);

const args = minimist(process.argv.slice(1));
let busTimeout = 30000;
if (args.busTimeout) {
    busTimeout = parseInt(args.busTimeout);
}
let busPath = 0;
if (args.busPath) {
    busPath = parseInt(args.busPath);
}

const maxSize = 10000000;
function testIPC(ipcBus) {
    let counter = 0;
    const buffer = Buffer.alloc(maxSize);
    const time = setInterval(() => {
        const subbuffer = buffer.slice(0, maxSize * Math.random());
        ipcBus.send(`test-perf`, counter, { buffer: subbuffer });
        console.log(`test-perf ${counter} - ${subbuffer.length}`)
        ++counter;
        if (counter >= 1000) {
            clearInterval(time);
        }
    }, 1);
}

const ipcClient = ipcBusModule.IpcBusClient.Create();
ipcClient.connect(busPath, { peerName: 'Node client', timeoutDelay: busTimeout })
.then(() => {

    console.log(`Node client: connected`);

    ipcClient.on('Node client ACK', (event) => {
        if (event.request) {
            console.log('Node client ACK');
            event.request.resolve('ACK');
        }
    });

    setTimeout(() => {
        testIPC(ipcClient);
    }, 5000);

    process.send(JSON.stringify({ ready: { resolve: true }}));
})
.catch((err) => {
    process.send(JSON.stringify({ ready: { reject: true, error: err }}));
});

// Keep process alive
process.stdin.on("data", () => {});