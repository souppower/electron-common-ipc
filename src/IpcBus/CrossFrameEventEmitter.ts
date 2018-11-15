import * as uuid from 'uuid';

import { EventEmitter } from 'events';
import { IpcBusTransportInWindow } from './IpcBusClientTransportRenderer';
import { IPCBUS_TRANSPORT_RENDERER_CONNECT, IPCBUS_TRANSPORT_RENDERER_EVENT } from './IpcBusClientTransportRenderer';

const trace = true;

// function isInWorker(): boolean {
//     return  typeof Worker === 'undefined' && typeof Window === 'undefined';
// }

interface CrossFrameMessage {
    uuid: string;
    channel: string;
    args?: any[];
}

export class CrossFrameEventEmitter extends EventEmitter implements IpcBusTransportInWindow {
    private _target: Window;
    private _origin: string;
    private _uuid: string;
    private _messageChannel: MessageChannel;

    constructor(target: Window, origin?: string) {
        super();
        this._target = target;
        this._origin = origin || '*';

        this._uuid = uuid.v4();

        this._messageChannel = new MessageChannel();

        // Callback
        this._messageHandler = this._messageHandler.bind(this);

        this._listen();
    }

    // Listens in a cross-browser fashion. When postmessage isn't available
    // we'll either have to change listen or fake message events somehow.
    protected _listen() {
        trace && console.log(`CFEE ${this._uuid} - init`);
        this._messageChannel.port1.addEventListener('message', this._messageHandler);
        this._messageChannel.port1.start();
        let packet = CrossFrameEventEmitter.encode(this._uuid, 'init', []);
        this._target.postMessage(packet, this._origin, [this._messageChannel.port2]);
    }

    // Get the channel and arguments and send it to the target
    // Channel is the event that the other side will be listening for
    send(channel: string, ...args: any[]): void {
        trace && console.log(`CFEE ${this._uuid} - send ${channel} - ${args}`);
        let packet = CrossFrameEventEmitter.encode(this._uuid, channel, args);
        this._messageChannel.port1.postMessage(packet);
    }

    // Cleans up event listeners
    stopListening() {
        trace && console.log(`CFEE ${this._uuid} - exit`);
        let packet = CrossFrameEventEmitter.encode(this._uuid, 'exit', []);
        this._target.postMessage(packet, this._origin);
        this._messageChannel.port1.close();
    }

    // Unpacks and emits
    protected _eventHandler(channel: string, ...args: any[]) {
        trace && console.log(`CFEE ${this._uuid} - emit ${channel} - ${args}`);
        this.emit(channel, ...args);
    }

    protected _messageHandler(event: MessageEvent) {
        trace && console.log(`CFEE ${this._uuid} - messageHandler ${JSON.stringify(event)}`);
        let packet = CrossFrameEventEmitter.decode(event.data);
        if (packet) {
            if (Array.isArray(packet.args)) {
                this._eventHandler(packet.channel, ...packet.args);
            }
            else {
                this._eventHandler(packet.channel);
            }
        }
    }

    // Takes a message data string and deserialises it
    static decode(data: any): CrossFrameMessage {
        // We don't control all message events, they won't always be JSON
        try {
            let packet = data['_electron_common_ipc_'];
            if (packet) {
                return packet;
            }
        }
        catch (e) {
        }
        return null;
    }

    // Takes a channel and the arguments to emit with and serialises it
    // for transmission
    static encode(uuid: string, channel: string, args: any[]): any {
        return {
            '_electron_common_ipc_': {
                uuid,
                channel,
                args: args
            }
        };
    }
}

export class CrossFrameEventDispatcher {
    protected _target: Window;
    protected _uuid: string;
    protected _ports: Map<string, MessagePort>;

    constructor(target: Window) {
        this._target = target;
        this._uuid = uuid.v4();
        this._ports = new Map<string, MessagePort>();

        // Callback
        this._lifecycleHandler = this._lifecycleHandler.bind(this);
        this._messageHandler = this._messageHandler.bind(this);

        this._listen();
    }

    // Listens in a cross-browser fashion. When postmessage isn't available
    // we'll either have to change listen or fake message events somehow.
    protected _listen() {
        trace && console.log(`CFEDisp ${this._uuid} - listen`);
        let target = this._target as any;
        if (target.addEventListener) {
            target.addEventListener('message', this._lifecycleHandler);
        }
        else if (target.attachEvent) {
            target.attachEvent('onmessage', this._lifecycleHandler);
        }
    }

    protected _lifecycleHandler(event: MessageEvent) {
        let packet = CrossFrameEventEmitter.decode(event.data);
        trace && console.log(`CFEDisp ${this._uuid} - lifecycle - ${JSON.stringify(packet)}`);
        if (packet) {
            if (packet.channel === 'init') {
                trace && console.log(`CFEDisp ${this._uuid} - lifecycle - init ${packet.uuid}`);
                let port = event.ports[0];
                this._ports.set(packet.uuid, port);
                port.addEventListener('message', this._messageHandler);
                port.start();
            }
            else if (packet.channel === 'exit') {
                trace && console.log(`CFEDisp ${this._uuid} - lifecycle - exit ${packet.uuid}`);
                this._ports.delete(packet.uuid);
                // port.close();
            }
        }
    }

    // Unpacks and emits
    protected _messageHandler(event: MessageEvent) {
        trace && console.log(`CFEDisp ${this._uuid} - messageHandler ${JSON.stringify(event)}`);
        let packet = CrossFrameEventEmitter.decode(event.data);
        if (packet) {
            trace && console.log(`CFEDisp ${this._uuid} - messageHandler - ${packet}`);
            this._ports.forEach((port, uuid) => {
                if (uuid !== packet.uuid) {
                    port.postMessage(event.data);
                }
            });
        }
    }
}

export class IpcBusFrameBridge extends CrossFrameEventDispatcher {
    protected _ipcBusTransportWindow: IpcBusTransportInWindow;

    constructor(ipcBusTransportWindow: IpcBusTransportInWindow, target: Window) {
        super(target);
        this._ipcBusTransportWindow = ipcBusTransportWindow;

        // Callback
        this._messageTransportHandlerEvent = this._messageTransportHandlerEvent.bind(this);
        this._messageTransportHandlerConnect = this._messageTransportHandlerConnect.bind(this);

        this._ipcBusTransportWindow.on(IPCBUS_TRANSPORT_RENDERER_CONNECT, this._messageTransportHandlerConnect);
        this._ipcBusTransportWindow.on(IPCBUS_TRANSPORT_RENDERER_EVENT, this._messageTransportHandlerEvent);
    }

    // Unpacks and emits
    protected _messageHandler(event: MessageEvent) {
        let packet = CrossFrameEventEmitter.decode(event.data);
        trace && console.log(`IpcBusFrameBridge - messageHandler - ${JSON.stringify(packet)}`);
        if (packet) {
            if (Array.isArray(packet.args)) {
                this._ipcBusTransportWindow.send(packet.channel, ...packet.args);
            }
            else {
                this._ipcBusTransportWindow.send(packet.channel);
            }
        }
    }

    protected _messageTransportHandlerEvent(...args: any[]) {
        trace && console.log(`_messageTransportHandlerEvent ${args}`);
        let packet = CrossFrameEventEmitter.encode('dispatcher', IPCBUS_TRANSPORT_RENDERER_EVENT, args);
        this._ports.forEach((port) => {
             port.postMessage(packet);
        });
    }

    protected _messageTransportHandlerConnect(...args: any[]) {
        trace && console.log(`_messageTransportHandlerConnect ${args}`);
        let packet = CrossFrameEventEmitter.encode('dispatcher', IPCBUS_TRANSPORT_RENDERER_EVENT, args);
        this._ports.forEach((port) => {
            port.postMessage(packet);
       });
   }
}


