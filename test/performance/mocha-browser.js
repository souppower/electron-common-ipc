const { BrowserWindow } = require('electron');

function RunMochaBrowser(args) {
    return new Promise<((resolve, reject) => {
        let url = args.shift();
        let browserWindow = new BrowserWindow({
            show: true,
            height: 700,
            width: 1200,
            webPreferences: { webSecurity: false, sandbox: false }
        });
        browserWindow.on('closed', () => {
            resolve();
        });
        browserWindow.loadFile(url);
    });
}