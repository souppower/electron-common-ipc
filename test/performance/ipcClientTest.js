const ipcBusModule = require('../../lib/electron-common-ipc');
const uuid = require('uuid');

const eventTestSend = 'test-send';

const IpcClientTest = function _IpcClientTest(name, busPath, busTimeout) {
    const _name = name;
    const _busPath = busPath;
    const _busTimeout = busTimeout;
    let _results = [];

    this.ipcClient = ipcBusModule.IpcBusClient.Create();

    this.create = () => {
        return this.ipcClient.connect(_busPath, { peerName: _name, timeoutDelay: _busTimeout })
        .then(() => {
            this.ipcClient.on(eventTestSend, (event, msg) => {
                // Break echo
                if (msg.sender.id === this.ipcClient.peer.id) {
                    return;
                }
                // msg.time_receiver = process.hrtime();
                msg.time_receiver = Date.now();
                msg.receiver = this.ipcClient.peer;
                console.log(`${eventTestSend} event`);
                console.log(JSON.stringify(msg, null, 4));
                // callback && callback(response);
                _results.push(msg);
            });
            this.ipcClient.on('test-request', (event, msg) => {
                // Break echo
                if (msg.sender.id === this.ipcClient.peer.id) {
                    return;
                }
                msg.time_receiver = Date.now();
                msg.receiver = this.ipcClient.peer;
                console.log(`test-request event`);
                console.log(JSON.stringify(msg, null, 4));
                // callback && callback(response);
                if (event.request) {
                    event.request.resolve(msg);
                }
            });
            this.ipcClient.on('collect-results', () => {
                console.log(`collect-results event`);
                this.ipcClient.send('results', _results);
                _results = [];
            })
            return this.ipcClient;
        });
    }

    this.startRequestTest = (payload) => {
        const id = uuid.v1();
        const test = { type: 'request', id, sender: this.ipcClient.peer, time_sender: Date.now(), payload };
        this.ipcClient.request('test-request', _busTimeout, test)
        .then((response) => {
            response.time_request = Date.now();
            // response.time_request = process.hrtime();
            _results.push(response);
        })
        .catch((err) => {
        });
    }

    this.startSendTest = (payload) => {
        const id = uuid.v1();
        const test = { type: 'send', id, sender: this.ipcClient.peer, time_sender: Date.now(), payload };
        this.ipcClient.send(eventTestSend, test);
    }
}

exports.IpcClientTest = IpcClientTest;
