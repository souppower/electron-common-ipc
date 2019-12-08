const uuid = require('uuid');

function GetQueryStringParams(sParam) {
    const sPageURL = window.location.search.substring(1);
    // console.log(`1 GetQueryStringParams ${sPageURL}`);
    const sURLVariables = sPageURL.split('&');
    // console.log(`2 GetQueryStringParams ${sURLVariables}`);
    for (let i = 0; i < sURLVariables.length; i++) {
        // console.log(`3 GetQueryStringParams ${sURLVariables[i]}`);
        const sParameterName = sURLVariables[i].split('=');
        // console.log(`4 GetQueryStringParams ${sParameterName}`);
        if (sParameterName[0] == sParam) {
            // console.log(`5 GetQueryStringParams ${sParameterName[1]}`);
            return sParameterName[1];
        }
    }
    return undefined;
}

const default_window_id = uuid.v1();
window.GetWindowId = () => {
    let window_id = GetQueryStringParams('id');
    if (!window_id) {
        window_id = default_window_id;
    }
    console.log(`GetWindowId ${window_id}`);
    return window_id;
}

window.addEventListener('load', () => {
    const electronCommonIpcModule = require('../..');
    {
        const result = electronCommonIpcModule.PreloadElectronCommonIpc(true);
        console.log(`PreloadElectronCommonIpc=${result}`);
    }
    {
        const result = electronCommonIpcModule.IsElectronCommonIpcAvailable();
        console.log(`IsElectronCommonIpcAvailable=${result}`);
    }

    const electronCommonIpcModuleCFEE = require('../../lib/IpcBus/CrossFrameEventEmitter2');
    if (window.self === window.top) {
        // console.log('Create Parent CrossFrameEventEmitter');
        // let crossFrameEE = new electronCommonIpcModuleCFEE.CrossFrameEventEmitter(window);
        // crossFrameEE.on('test-parent', (...args) => {
        //     console.log(`crossFrameEE - Parent receive message : ${args}`);
        // });
        // setTimeout(() => {
        //     console.log('Parent send message');
        //     crossFrameEE.send('test-frame', 'hello frame');
        // }, 100);
        const window_id = GetWindowId();
        const ipcBus = electronCommonIpcModule.CreateIpcBusClient();
        ipcBus.connect({ peerName: `client-parent-${window_id}` })
        .then(() => {
            ipcBus.on(`test-parent-${window_id}`, (...args) => {
                console.log(`ipcBus - Parent receive message : ${args}`);
            });
            ipcBus.on(`test-myself-${window_id}`, (...args) => {
                console.log(`ipcBus - self receive message : ${args}`);
            });
            setTimeout(() => {
                console.log('ipcBus - Parent send message');
                ipcBus.send(`test-frame-${window_id}`, 'hello frame');
                ipcBus.send(`test-myself-${window_id}`, 'hello myself');
            }, 100);
        })
        .catch((err) => {
            console.log(`ipcBus - Parent error ${err}`);
        });
    }
    else {
        const window_id = GetWindowId();
        console.log(`window.name = ${window.name} - ${window_id}`);
        
        // console.log('Create Frame CrossFrameEventEmitter');
        // let crossFrameEE = new electronCommonIpcModuleCFEE.CrossFrameEventEmitter(window.parent);
        // crossFrameEE.on('test-frame', (...args) => {
        //     console.log(`crossFrameEE - Frame receive message : ${args}`);
        // });
        // setTimeout(() => {
        //     console.log('Frame send message');
        //     crossFrameEE.send('test-parent', 'hello parent');
        // }, 200);

        const ipcBus = electronCommonIpcModule.CreateIpcBusClient();
        ipcBus.connect({ peerName: `client-frame-${window_id}`, timeoutDelay: 8000 })
        .then(() => {
            ipcBus.on(`test-frame-${window_id}`, (...args) => {
                console.log(`ipcBus - Frame receive message : ${args}`);
            });
            setTimeout(() => {
                console.log('ipcBus - Frame send message');
                ipcBus.send(`test-parent-${window_id}`, 'hello parent');
            }, 200);
        })
        .catch((err) => {
            console.log(`ipcBus - Frame error ${err}`);
        });
    }
    // console.log(`id=${window_id}`);

})
