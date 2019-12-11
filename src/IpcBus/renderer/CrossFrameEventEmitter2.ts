import * as uuid from 'uuid';
import { EventEmitter } from 'events';

import { IpcWindow } from '../main/IpcBusTransportIpc';
import { IPCBUS_TRANSPORT_RENDERER_CONNECT, IPCBUS_TRANSPORT_RENDERER_EVENT } from '../main/IpcBusTransportIpc';

import { CrossFrameMessage } from './CrossFrameMessage';

// const trace = true;
const trace = false;

// function isInWorker(): boolean {
//     return  typeof Worker === 'undefined' && typeof Window === 'undefined';
// }

export class CrossFrameEventEmitter extends EventEmitter implements IpcWindow {
    private _target: Window;
    private _origin: string;
    private _uuid: string;
    private _messageChannel: MessageChannel;

    constructor(target: Window, origin?: string) {
        super();
        this._target = target;
        this._origin = origin || '*';

        this._uuid = uuid.v4();

        // Callback
        this._messageHandler = this._messageHandler.bind(this);

        this._start();

        if (trace) {
            this.on('newListener', (event: string) => {
                trace && console.log(`CFEE ${this._uuid} - newListener ${event}`);
            });
            this.on('removeListener', (event: string) => {
                trace && console.log(`CFEE ${this._uuid} - removeListener ${event}`);
            });
        }

        window.addEventListener('unload', () => {
            trace && console.log(`CFEE ${this._uuid} - unload event`);
            this.close();
        });
    }

    // Listens in a cross-browser fashion. When postmessage isn't available
    // we'll either have to change listen or fake message events somehow.
    protected _start() {
        if (this._messageChannel == null) {
            trace && console.log(`CFEE ${this._uuid} - init`);
            this._messageChannel = new MessageChannel();
            this._messageChannel.port1.addEventListener('message', this._messageHandler);
            this._messageChannel.port1.start();
            const packet = CrossFrameMessage.Encode(this._uuid, 'init', []);
            this._target.postMessage(packet, this._origin, [this._messageChannel.port2]);
        }
    }

    // Cleans up event listeners
    close() {
        if (this._messageChannel != null) {
            trace && console.log(`CFEE ${this._uuid} - exit`);
            const packet = CrossFrameMessage.Encode(this._uuid, 'exit', []);
            this._target.postMessage(packet, this._origin);
            this._messageChannel.port1.removeEventListener('message', this._messageHandler);
            this._messageChannel.port1.close();
            this._messageChannel = null;
        }
    }

    // Get the channel and arguments and send it to the target
    // Channel is the event that the other side will be listening for
    send(channel: string, ...args: any[]): void {
        trace && console.log(`CFEE ${this._uuid} - send: ${channel} - ${JSON.stringify(args)}`);
        const packet = CrossFrameMessage.Encode(this._uuid, channel, args);
        this._messageChannel.port1.postMessage(packet);
    }

    // Unpacks and emits
    protected _eventHandler(channel: string, ...args: any[]) {
        trace && console.log(`CFEE ${this._uuid} - emit: ${channel} - ${JSON.stringify(args)} => ${this.listenerCount(channel)}`);
        this.emit(channel, ...args);
    }

    protected _messageHandler(event: MessageEvent) {
        trace && console.log(`CFEE ${this._uuid} - messageHandler: ${JSON.stringify(event)}`);
        const packet = CrossFrameMessage.Decode(event.data);
        if (packet) {
            if (Array.isArray(packet.args)) {
                this._eventHandler(packet.channel, ...packet.args);
            }
            else {
                this._eventHandler(packet.channel);
            }
        }
    }
}

export class CrossFrameEventDispatcher {
    protected _target: Window;
    protected _uuid: string;
    protected _ports: Map<string, MessagePort>;
    private _started: boolean;

    constructor(target: Window) {
        this._target = target;

        // Callback
        this._lifecycleHandler = this._lifecycleHandler.bind(this);
        this._messageHandler = this._messageHandler.bind(this);

        this._started = false;
    }

    // Listens in a cross-browser fashion. When postmessage isn't available
    // we'll either have to change listen or fake message events somehow.
    start() {
        if (this._started === false) {
            trace && console.log(`CFEDisp ${this._uuid} - start`);

            this._started = true;
            this._uuid = uuid.v4();
            this._ports = new Map<string, MessagePort>();

            const target = this._target as any;
            if (target.addEventListener) {
                target.addEventListener('message', this._lifecycleHandler);
            }
            else if (target.attachEvent) {
                target.attachEvent('onmessage', this._lifecycleHandler);
            }
        }
    }

    stop() {
        if (this._started) {
            trace && console.log(`CFEDisp ${this._uuid} - stop`);

            this._started = false;

            const target = this._target as any;
            if (target.addEventListener) {
                target.removeEventListener('message', this._lifecycleHandler);
            }
            else if (target.attachEvent) {
                target.detachEvent('onmessage', this._lifecycleHandler);
            }

            this._ports.forEach((port) => {
                port.removeEventListener('message', this._messageHandler);
                port.close();
            });
            this._ports.clear();
            this._ports = null;
        }
    }

    protected _lifecycleHandler(event: MessageEvent) {
        const packet = CrossFrameMessage.Decode(event.data);
        trace && console.log(`CFEDisp ${this._uuid} - lifecycle - ${JSON.stringify(packet)}`);
        if (packet) {
            if (packet.channel === 'init') {
                trace && console.log(`CFEDisp ${this._uuid} - lifecycle - init ${packet.uuid}`);
                let port = this._ports.get(packet.uuid);
                if (port == null) {
                    port = event.ports[0];
                    this._ports.set(packet.uuid, port);
                    port.addEventListener('message', this._messageHandler);
                    port.start();
                }
            }
            else if (packet.channel === 'exit') {
                trace && console.log(`CFEDisp ${this._uuid} - lifecycle - exit ${packet.uuid}`);
                let port = this._ports.get(packet.uuid);
                if (port) {
                    this._ports.delete(packet.uuid);
                    port.removeEventListener('message', this._messageHandler);
                    port.close();
                }
            }
        }
    }

    // Unpacks and emits
    protected _messageHandler(event: MessageEvent) {
        trace && console.log(`CFEDisp ${this._uuid} - messageHandler ${JSON.stringify(event)}`);
        const packet = CrossFrameMessage.Decode(event.data);
        if (packet) {
            trace && console.log(`CFEDisp ${this._uuid} - messageHandler - ${packet}`);
            this._ports.forEach((port, uuid) => {
                // Prevent Echo
                if (uuid !== packet.uuid) {
                    port.postMessage(event.data);
                }
            });
        }
    }
}

export class IpcBusFrameBridge extends CrossFrameEventDispatcher {
    protected _ipcWindow: IpcWindow;

    constructor(ipcWindow: IpcWindow, target: Window) {
        super(target);
        this._ipcWindow = ipcWindow;

        // Callback
        this._messageTransportHandlerEvent = this._messageTransportHandlerEvent.bind(this);
        this._messageTransportHandlerConnect = this._messageTransportHandlerConnect.bind(this);
    }

    start() {
        super.start();
        this._ipcWindow.addListener(IPCBUS_TRANSPORT_RENDERER_CONNECT, this._messageTransportHandlerConnect);
        this._ipcWindow.addListener(IPCBUS_TRANSPORT_RENDERER_EVENT, this._messageTransportHandlerEvent);
    }

    stop() {
        this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_CONNECT, this._messageTransportHandlerConnect);
        this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_EVENT, this._messageTransportHandlerEvent);
        super.stop();
    }

    // Unpacks and emits
    protected _messageHandler(event: MessageEvent) {
        const packet = CrossFrameMessage.Decode(event.data);
        trace && console.log(`IpcBusFrameBridge - messageHandler - ${JSON.stringify(packet)}`);
        if (packet) {
            if (Array.isArray(packet.args)) {
                this._ipcWindow.send(packet.channel, ...packet.args);
            }
            else {
                this._ipcWindow.send(packet.channel);
            }
        }
    }

    protected _messageTransportHandlerEvent(...args: any[]) {
        trace && console.log(`_messageTransportHandlerEvent ${JSON.stringify(args)}`);
        const packet = CrossFrameMessage.Encode('dispatcher', IPCBUS_TRANSPORT_RENDERER_EVENT, args);
        this._ports.forEach((port) => {
            port.postMessage(packet);
        });
    }

    protected _messageTransportHandlerConnect(...args: any[]) {
        trace && console.log(`_messageTransportHandlerConnect ${JSON.stringify(args)}`);
        const packet = CrossFrameMessage.Encode('dispatcher', IPCBUS_TRANSPORT_RENDERER_CONNECT, args);
        this._ports.forEach((port) => {
            port.postMessage(packet);
        });
    }
}


