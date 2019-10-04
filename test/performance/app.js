const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const child_process = require('child_process');

const { createClient } = require('./createClient.js');
const brokersLifeCycle = require('../brokers/brokersLifeCycle');

// const ipcBusModule = require('../../lib/electron-common-ipc');
// ipcBusModule.ActivateIpcBusTrace(true);

function createIPCBusNodeClient(busPath, busTimeout) {
    return new Promise((resolve, reject) => {

        const args = [
            path.join(__dirname, 'node.js'),
            // '--inspect-brk=9229',
            `--busPath=${busPath}`,
            `--busTimeout=${busTimeout}`,
        ];
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
    return createClient('client Main', busPath, busTimeout, (response) => {
        ipcMain.send('response', response);
    })
}


function createIPCBusClients() {
    const brokers = new brokersLifeCycle.Brokers()
    brokers.start()
        .then(() => {
            const busPath = brokers.getBusPath();
            const busTimeout = 3000;
            return Promise.all([
                createIPCBusNodeClient(busPath, busTimeout),
                createIPCBusRendererClient(busPath, busTimeout)
            ]);
        });
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