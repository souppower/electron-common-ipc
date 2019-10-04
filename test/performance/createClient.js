function createClient(name, busPath, busTimeout, callback) {
    const ipcBusModule = require('../../lib/electron-common-ipc');
    const ipcClient = ipcBusModule.IpcBusClient.Create(busPath);
    return ipcClient.connect({ peerName: 'client Node', timeoutDelay: busTimeout })
        .then(() => {
            ipcClient.on('test-message', (event, ...args) => {
                const hrtime = process.hrtime();
                const response = { event, args, hrtime };
                console.log(`test-message event=${event}, args=${args}`);
                callback(response);
            });
            ipcClient.on('test-request', (event, ...args) => {
                const hrtime = process.hrtime();
                const response = { event, args, hrtime };
                callback(response);
                console.log(`test-request event=${event}, args=${args}`);
                if (event.request) {
                    event.request.resolve(JSON.stringify({ event, args, hrtime }));
                }
            });
        });
}

module.exports.createClient = createClient;