import { EventEmitter } from 'events';

import { IpcBusTransportInWindow } from './IpcBusClientTransportRenderer';

function Encode(data: any): any {
    return { 'electron-common-ipc': true, data };
}

function Decode(message: any): any {
    if ((typeof message === 'object') && message['electron-common-ipc']) {
        return message.data;
    }
    throw 'unknown message';
}

export class IpcBusBridgeTransportInFrame {
    constructor() {
        this._handleMessage = this._handleMessage.bind(this);
        window.addEventListener('message', this._handleMessage);
    }

    private _handleMessage(message: any) {
        try {
            let data = Decode(message);
        }
        catch (_) {
        }
    }
}

export class IpcBusTransportInFrame extends EventEmitter implements IpcBusTransportInWindow {
    private _messageChannel: MessageChannel;
    constructor() {
        super();

        this._messageChannel = new MessageChannel();
        this._handleMessage = this._handleMessage.bind(this);
        this._messageChannel.port1.addEventListener('message', this._handleMessage);
        this._messageChannel.port1.start();
    }

    private _handleMessage(message: any) {
        try {
            let data = Decode(message);
        }
        catch (_) {
        }
    }

    start() {
        window.parent.postMessage(Encode('init'), '*', [this._messageChannel.port2]);
    }

    send(channel: string, ...args: any[]): void {
        this._messageChannel.port1.postMessage(Encode({channel, args}));
    }
}