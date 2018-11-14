const uuid = require('uuid');

let window_id = uuid.v1();
window.GetWindowId = () => {
    return window_id;
}

window.addEventListener('load', () => {
    const electronCommonIpcModule = require('../..');
    {
        let result = electronCommonIpcModule.PreloadElectronCommonIpc();
        console.log(`PreloadElectronCommonIpc=${result}`);
    }
    {
        let result = electronCommonIpcModule.IsElectronCommonIpcAvailable();
        console.log(`IsElectronCommonIpcAvailable=${result}`);
    }

    if (window.self === window.top) {
        console.log('Create FrameSet CrossFrameEventEmitter');
        let crossFrameEE = new electronCommonIpcModule.CrossFrameEventEmitter(window);
        crossFrameEE.on('test-frameset', (...args) => {
            console.log(`FrameSet receive message : ${args}`);
            console.log('it works !!');
        });
        setTimeout(() => {
            console.log('FrameSet send message');
            crossFrameEE.send('test-frame', 'hello frame');
        },
        200);
    }
    else {
        window_id = window.location.search;
        console.log('Create Frame CrossFrameEventEmitter');
        let crossFrameEE = new electronCommonIpcModule.CrossFrameEventEmitter(window.parent);
        crossFrameEE.on('test-frame', (...args) => {
            console.log(`Frame receive message : ${args}`);
            console.log('it works !!');
        });
        setTimeout(() => {
            console.log('Frame send message');
            crossFrameEE.send('test-frameset', 'hello frameset');
        },
        200);

        let ipcBus = electronCommonIpcModule.CreateIpcBusClient({peerName: window.href});
        console.log(ipcBus);
    }
    console.log(`id=${window_id}`);

})
