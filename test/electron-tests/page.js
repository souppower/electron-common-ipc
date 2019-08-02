const uuid = require('uuid');

let window_id = uuid.v1();
window.GetWindowId = () => {
    // console.log(`GetWindowId=${window_id}`);
    return window_id;
}

function GetQueryStringParams(sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) {
            return sParameterName[1];
        }
    }
}

window.addEventListener('load', () => {
    const electronCommonIpcModule = require('../..');
    {
        let result = electronCommonIpcModule.PreloadElectronCommonIpc(true);
        console.log(`PreloadElectronCommonIpc=${result}`);
    }
    {
        let result = electronCommonIpcModule.IsElectronCommonIpcAvailable();
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
        let ipcBus = electronCommonIpcModule.CreateIpcBusClient({ peerName: `client-parent-${window_id}` });
        ipcBus.connect()
        .then(() => {
            ipcBus.on(`test-parent-${window_id}`, (...args) => {
                console.log(`ipcBus - Parent receive message : ${args}`);
            });
            setTimeout(() => {
                console.log('ipcBus - Parent send message');
                ipcBus.send(`test-frame-${window_id}`, 'hello frame');
            }, 100);
        });
    }
    else {
        window_id = GetQueryStringParams('id');
        console.log(`window.name = ${window.name} - ${window.id}`);
        
        // console.log('Create Frame CrossFrameEventEmitter');
        // let crossFrameEE = new electronCommonIpcModuleCFEE.CrossFrameEventEmitter(window.parent);
        // crossFrameEE.on('test-frame', (...args) => {
        //     console.log(`crossFrameEE - Frame receive message : ${args}`);
        // });
        // setTimeout(() => {
        //     console.log('Frame send message');
        //     crossFrameEE.send('test-parent', 'hello parent');
        // }, 200);

        let ipcBus = electronCommonIpcModule.CreateIpcBusClient({ peerName: `client-frame-${window_id}` });
        ipcBus.connect({ timeoutDelay: 4000})
        .then(() => {
            ipcBus.on(`test-frame-${window_id}`, (...args) => {
                console.log(`ipcBus - Frame receive message : ${args}`);
            });
            setTimeout(() => {
                console.log('ipcBus - Frame send message');
                ipcBus.send(`test-parent-${window_id}`, 'hello parent');
            }, 200);
        });
    }
    // console.log(`id=${window_id}`);

})
