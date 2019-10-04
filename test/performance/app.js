const { app, BrowserWindow } = require('electron')
const path = require('path')

const brokersLifeCycle = require('../brokers/brokersLifeCycle');
const RunMochaBrowser = require('./mocha-browser');

// const ipcBusModule = require('../../lib/electron-common-ipc');
// ipcBusModule.ActivateIpcBusTrace(true);

function createIPCBusNodeClient(busPath, busTimeout) {
    return new Promise((resolve, reject) => {
        const options = { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] };
        // nodeChildProcess = child_process.fork(path.join(__dirname, 'nodeClient.js'), ['--inspect-brk=9229', `--busPath=${ipcBusPath}`], options);
        const nodeChildProcess = child_process.fork(path.join(__dirname, 'node.js'), [
            // '--inspect-brk=9229',
            `--busPath=${busPath}`,
            `--busTimeout=${busTimeout}`
        ],
            options);
        nodeChildProcess.addListener('close', onClose);
        nodeChildProcess.addListener('disconnect', onDisconnect);
        nodeChildProcess.addListener('error', onError);
        nodeChildProcess.addListener('exit', onExit);
        // nodeChildProcess.stdout.addListener('data', onStdOutData);
        // nodeChildProcess.stdout.addListener('end', onStdOutEnd);
        nodeChildProcess.stderr.addListener('data', onStdErrData);
        nodeChildProcess.stderr.addListener('end', onStdErrEnd);
        nodeChildProcess.addListener('message', (rawmessage, sendHandle) => {
            const message = JSON.parse(rawmessage);
            console.log(`ProcessHost, onChildMessage, [pid:${nodeChildProcess.pid}], ${JSON.stringify(message)}.`);
            if (message.ready) {
                if (message.resolve) {
                    resolve(nodeChildProcess);
                }
                if (message.reject) {
                    reject(message.error);
                }
            }
        });
    });
}

function createIPCBusRendererClient(busPath, busTimeout) {
    return new Promise((resolve, reject) => {
        const browserWindow = new BrowserWindow({ 
            x, y, width: 800, height: 200,
            show: true,
            webPreferences: { 
                nodeIntegration: false, 
                preload: path.join(__dirname, 'renderer-preload.bundle.js') 
            }
        });
        browserWindow.webContents.on('ready', (msg) => {
            if (msg.resolve) {
                resolve(nodeChildProcess);
            }
            if (msg.reject) {
                reject(message.error);
            }

        });
        browserWindow.loadFile(path.join(__dirname, 'renderer.html'));
        const webContents = browserWindow.webContents;
        if (webContents.getURL() && !webContents.isLoadingMainFrame()) {
            webContents.send('init-window', busPath, busTimeout);
        }
        else {
            webContents.on('did-finish-load', () => {
                webContents.send('init-window', busPath, busTimeout);
            });
        }
    });
    
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