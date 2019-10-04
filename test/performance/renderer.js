const { createClient } = require('./createClient.js');

window.ipcRenderer.on('init-window', (event, id, busPath, busTimeout) => {
    console.log(event);
    console.log(id);
    console.log(busPath);
    createClient('client Renderer', busPath, busTimeout, (response) => {
        window.ipcRenderer.send('response', response);
    })
    .then(() => {
        window.ipcRenderer.send(`ready-${id}`, { resolve: true });
    })
    .catch((err) => {
        window.ipcRenderer.send(`ready-${id}`, { reject: true, error: err });
    });
});

