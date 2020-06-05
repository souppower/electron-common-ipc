const { app, BrowserWindow } = require('electron')
const path = require('path')

const brokersLifeCycle = require('../brokers/brokersLifeCycle');
const ipcBusModule = require("../..");

// const ipcBusModule = require('../../lib/electron-common-ipc');
// ipcBusModule.ActivateIpcBusTrace(true);

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.

let done
let x = 0, y = 0
let idWindow  = 0;

function testIPC(id) {
    const ipcBus = ipcBusModule.CreateIpcBusClient();
    ipcBus.connect().then(() => {
        let counter = 0;
        setInterval(() => {
            const buffer = Buffer.alloc(8000000 * Math.random());
            ipcBus.send(`test-perf`, counter, { buffer });
            console.log(`test-perf ${counter} - ${buffer.length}`)
            ++counter;
        }, 50);
    });
}

function createWindow(page, title, webPreferences) {
    // Create the browser window.
    let win = new BrowserWindow({ x, y, width: 800, height: 200, webPreferences })
    // win.loadFile(path.join(__dirname, page) + `?id=${idWindow}`);
    win.loadURL(`file://${path.join(__dirname, page)}?id=${idWindow}`);

    if (idWindow === 0) {
        testIPC(idWindow);
    }

    ++idWindow;
    win.setTitle(`${page} - ${JSON.stringify(webPreferences)}`)

    // Open the DevTools.
    // win.webContents.openDevTools()

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    })

    y += 200
    if (y > 800) {
        y = 0
        x += 800
    }
    return win;
}

function createWindows() {
    const ipcBus = ipcBusModule.CreateIpcBusClient();
    ipcBus.connect().then(() => {
        done = true

        ipcBus.on(`test-main-buffer`, (event, data) => {
            console.log(`Buffer typeof=${typeof data}, content=${data.toString()}`);
        });
        ipcBus.on(`test-main-date`, (event, data) => {
            console.log(`Date typeof=${typeof data}, content=${data.toString()}`);
        });

        // createWindow('page.html', '{}', {})
        // createWindow('page.html', 'nodeIntegration: false', { nodeIntegration: false })
        // createWindow('page.html', 'nodeIntegration: false, sandbox: true', { nodeIntegration: false, sandbox: true })
        // createWindow('page.html', 'sandbox: true', { nodeIntegration: false, sandbox: true })

        // createWindow('page.html', 'preload', 
        //     { preload: path.join(__dirname, 'page-preload.bundle.js') })
        createWindow('page.html', 'preload nodeIntegration: false', 
            { nodeIntegration: false, preload: path.join(__dirname, 'page-preload.bundle.js') })
        // createWindow('page.html', 'preload nodeIntegration: false, sandbox: true', 
        //     { nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'page-preload.bundle.js') })
        // createWindow('page.html', 'preload sandbox: true', 
        //     { nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'page-preload.bundle.js') })

        // // createWindow('page-parent.html', '{}', {})
        // // createWindow('page-parent.html', 'nodeIntegration: false', { nodeIntegration: false })
        // // createWindow('page-parent.html', 'nodeIntegration: false, sandbox: true', { nodeIntegration: false, sandbox: true })
        // // createWindow('page-parent.html', 'sandbox: true', { nodeIntegration: false, sandbox: true })

        // createWindow('page-parent.html', 'preload',
        //     { preload: path.join(__dirname, 'page-preload.bundle.js') })
        // createWindow('page-parent.html', 'preload nodeIntegration: false',
        //     { nodeIntegration: false, preload: path.join(__dirname, 'page-preload.bundle.js') })
        // createWindow('page-parent.html', 'preload nodeIntegration: false, sandbox: true', 
        //     { nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'page-preload.bundle.js') })
        // createWindow('page-parent.html', 'preload sandbox: true',
        //     { nodeIntegration: true, sandbox: true, preload: path.join(__dirname, 'page-preload.bundle.js') })
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
let brokers;
app.on('ready', () => {
    brokers = new brokersLifeCycle.Brokers()
    brokers.start()
    .then(() => {
        createWindows();
    });
});

app.on('quit', () => {
    brokers.stop()
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (!done) {
        createWindows();
    }
})

  // In this file you can include the rest of your app's specific main process
  // code. You can also put them in separate files and require them here.