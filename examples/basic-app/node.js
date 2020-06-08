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

function testIPC(ipcBus) {
    let counter = 0;
    const buffer = Buffer.alloc(8000000);
    const time = setInterval(() => {
        const subbuffer = buffer.slice(0, 800000 * Math.random());
        ipcBus.send(`test-perf`, counter, { buffer: subbuffer });
        console.log(`test-perf ${counter} - ${subbuffer.length}`)
        ++counter;
        if (counter >= 100) {
            clearInterval(time);
        }
    }, 1);
}

const ipcClient = ipcBusModule.IpcBusClient.Create();
ipcClient.connect(busPath, { peerName: 'client Node', timeoutDelay: busTimeout })
.then(() => {

    ipcClient.on('client Node ACK', (event) => {
        if (event.request) {
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