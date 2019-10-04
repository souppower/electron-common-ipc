const createClient = require('./createClient.js')

window.ipcRenderer('init-window', (event, busPath, bustimeOut) => {
    createClient('client Renderer', busPath, busTimeout, (response) => {
        window.ipcRenderer.send('response', response);
    })
    .then(() => {
        window.ipcRenderer.send('ready', JSON.stringify({ resolve: true }));
    })
    .catch((err) => {
        window.ipcRenderer.send('ready', JSON.stringify({ reject: true, error: err }));
    });
});

