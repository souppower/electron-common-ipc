const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const child_process = require('child_process');
const ipcBusModule = require('electron-common-ipc');

const busPath = 49158; // '/tr-ipc-bus/' + uuid.v4();
const busTimeout = 3000;
console.log('IPC Bus Path : ' + busPath);

// Startup
let ipcBrokerProcess = null;
let ipcBroker = null;
let ipcBridge = null;

// Helpers
function spawnNodeInstance(scriptPath, busPath, busTimeout, newArgs) {
    return new Promise((resolve, reject) => {
        const args = [
            path.join(__dirname, scriptPath),
            // '--inspect-brk=9000',
            `--busPath=${busPath}`,
            `--busTimeout=${busTimeout}`,
        ].concat(newArgs || []);
        let options = { env: {} };
        for (let key of Object.keys(process.env)) {
            options.env[key] = process.env[key];
        }
        options.env['ELECTRON_RUN_AS_NODE'] = '1';
        options['stdio'] = ['pipe', 'pipe', 'pipe', 'ipc'];
        const nodeProcess = child_process.spawn(process.argv[0], args, options);
        nodeProcess.stdout.addListener('data', data => { console.log('<Node> ' + data.toString()); });
        nodeProcess.stderr.addListener('data', data => { console.log('<Node> ' + data.toString()); });
        nodeProcess.on('message', (msgStr) => {
            const msg = JSON.parse(msgStr);
            if (msg.ready) {
                if (msg.ready.resolve) {
                    resolve(nodeProcess);
                }
                else if (msg.ready.reject) {
                    reject(message.error);
                }
            }
            else if (msg.response) {
                ipcMain.send('response', response);
            }
        });
    });
}

// const ipcBusModule = require('../../lib/electron-common-ipc');
// ipcBusModule.ActivateIpcBusTrace(true);

function createIPCBusNodeClient(busPath, busTimeout) {
    return spawnNodeInstance('node.js', busPath, busTimeout
        // ,['--inspect-brk=9000']
    );
}

function createIPCBusRendererClient(busPath, busTimeout) {
    const id = 1;
    return new Promise((resolve, reject) => {
        const browserWindow = new BrowserWindow({
            width: 800, height: 800,
            show: true,
            webPreferences: {
                nodeIntegration: false,
                preload: path.join(__dirname, 'renderer-preload.bundle.js')
            }
        });
        ipcMain.on(`ready-${id}`, (event, msg) => {
            if (msg.resolve) {
                resolve(browserWindow);
            }
            else if (msg.reject) {
                reject(message.error);
            }
        });
        browserWindow.loadFile(path.join(__dirname, 'renderer.html'));
        const webContents = browserWindow.webContents;
        if (webContents.getURL() && !webContents.isLoadingMainFrame()) {
            webContents.send('init-window', id, busPath, busTimeout);
        }
        else {
            webContents.on('did-finish-load', () => {
                webContents.send('init-window', id, busPath, busTimeout);
            });
        }
    });
}

function createIPCBusMainClient(busPath, busTimeout) {
    const ipcClient = ipcBusModule.IpcBusClient.Create();
    return ipcClient.connect(busPath, { peerName: 'client Main', timeoutDelay: busTimeout })
        .then(() => {
            ipcClient.on('client Main ACK', (event) => {
                if (event.request) {
                    event.request.resolve('ACK');
                }
            });
            return ipcClient;
        });
}

var localIpcBroker = undefined;

function prepareApp() {
    ipcBridge = ipcBusModule.IpcBusBridge.Create();
    ipcBridge.connect(busPath, { server: localIpcBroker == null })
        .then((msg) => {
            console.log('<MAIN> IPC bridge is ready !');
            // Setup IPC Client (and renderer bridge)
            return Promise.all([
                createIPCBusMainClient(busPath, busTimeout),
                createIPCBusNodeClient(busPath, busTimeout),
                createIPCBusRendererClient(busPath, busTimeout)
            ])
                .then(([ipcClient, nodeProcess, browserWindow]) => {
                    console.log('ready');
                    return Promise.all([
                        ipcClient.request('client Main ACK', busTimeout),
                        ipcClient.request('client Node ACK', busTimeout),
                        ipcClient.request('client Renderer ACK', busTimeout)
                    ])
                        .then(([mainAnswer, nodeAnswer, rendererAnswer]) => {
                            console.log('bus ready');
                        })
                        .catch((err) => {
                            console.error(err);
                        });
                });
        });
}

function createIPCBusClients() {
    // Startup
    console.log('<MAIN> Starting IPC broker ...');
    if (localIpcBroker === true) {
        // Broker in Master process
        ipcBroker = ipcBusModule.IpcBusBroker.Create();
        ipcBroker.connect(busPath)
            .then((msg) => {
                console.log('<MAIN> IPC broker is ready !');
                prepareApp();
            })
            .catch((err) => {
                console.log("IPC Broker instance : " + err);
            });
    }
    else if (localIpcBroker === false) {
        // Setup Remote Broker
        ipcBrokerProcess = spawnNodeInstance('BrokerNodeInstance.js', busPath, busTimeout
        // ,['--inspect-brk=9000']
        )
        .then(() => {
            prepareApp();
        });
        // ipcBrokerProcess.stdout.addListener('data', data => { console.log('<BROKER> ' + data.toString()); });
        // ipcBrokerProcess.stderr.addListener('data', data => { console.log('<BROKER> ' + data.toString()); });
    }
    else {
        prepareApp();
    }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    createIPCBusClients();
});

app.on('quit', () => {
    brokers.stop()
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    // if (process.platform !== 'darwin') {
    //     app.quit()
    // }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (!done) {
        createIPCBusClients();
    }
})

  // In this file you can include the rest of your app's specific main process
  // code. You can also put them in separate files and require them here.