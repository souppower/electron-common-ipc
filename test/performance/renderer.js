const { IpcClientTest } = require('./ipcClientTest.js');

window.ipcRenderer.on('init-window', (event, id, busPath, busTimeout) => {
    const ipcClientTest = new IpcClientTest('client Renderer', busPath, busTimeout);
    ipcClientTest.create()
    .then(() => {
        window.ipcRenderer.send(`ready-${id}`, { resolve: true });
    })
    .catch((err) => {
        window.ipcRenderer.send(`ready-${id}`, { reject: true, error: err });
    });
});

