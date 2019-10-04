const ipcBusModule = require('../../lib/electron-common-ipc');
const uuid = require('uuid');

const IpcClientTest = function _IpcClientTest(name, busPath, busTimeout) {
    const _name = name;
    const _busPath = busPath;
    const _busTimeout = busTimeout;
    const _ipcClient = ipcBusModule.IpcBusClient.Create(_busPath);
    let _results = [];

    this.create = function() {
        return _ipcClient.connect({ peerName: _name, timeoutDelay: _busTimeout })
        .then(() => {
            _ipcClient.on('test-send', (event, msg) => {
                // Break echo
                if (msg.origin.id === _ipcClient.peer.id) {
                    return;
                }
                // msg.time_received = process.hrtime();
                msg.time_received = new Date().now;
                msg.receiver = _ipcClient.peerName;
                const response = { event, msg };
                console.log(`test-send event=${event}, msg=${msg}`);
                // callback && callback(response);
                _results.push(response);
            });
            _ipcClient.on('test-request', (event, msg) => {
                // Break echo
                if (msg.origin.id === _ipcClient.peer.id) {
                    return;
                }
                msg.time_received = new Date().now;
                msg.receiver = _ipcClient.peerName;
                const response = { event, msg };
                console.log(`test-request event=${event}, msg=${msg}`);
                // callback && callback(response);
                if (event.request) {
                    event.request.resolve(response);
                }
            });
            _ipcClient.on('collect-results', () => {
                _ipcClient.send('results', _results);
                _results = [];
            })
            return _ipcClient;
        });
    }

    this.startRequestTest = function(payload) {
        const id = uuid.v1();
        const test = { type: 'request', id, origin: _ipcClient.peer, time_origin: new Date().now, payload };
        _ipcClient.request('test-request', _busTimeout, test)
        .then((response) => {
            response.time_request = new Date().now;
            // response.time_request = process.hrtime();
            _results.push(response);
        })
        .catch((err) => {
        });
    }

    this.startSendTest = function(payload) {
        const id = uuid.v1();
        const test = { type: 'send', id, origin: _ipcClient.peer, time_origin: new Date().now, payload };
        _ipcClient.send('test-send', test);
    }
}

exports.IpcClientTest = IpcClientTest;
