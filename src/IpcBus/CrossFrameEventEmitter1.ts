import * as uuid from 'uuid';
import { EventEmitter } from 'events';

import { IpcWindow } from './IpcBusTransportWindow';
import { IPCBUS_TRANSPORT_RENDERER_CONNECT, IPCBUS_TRANSPORT_RENDERER_EVENT } from './IpcBusTransportWindow';

import { CrossFrameMessage } from './CrossFrameMessage';

const trace = true;

export class CrossFrameEventEmitter extends EventEmitter implements IpcWindow {
    private _target: Window;
    private _origin: string;
    private _uuid: string;
    private _started: boolean;

    constructor(target: Window, origin?: string) {
        super();
        this._target = target;
        this._origin = origin || '*';

        this._uuid = uuid.v4();

        // Callback
        this._messageHandler = this._messageHandler.bind(this);

        this._started = false;
        this.start();
    }

    protected _postMessage(packet: any) {
        return this._target.postMessage(packet, this._origin);
    }

    // Listens in a cross-browser fashion. When postmessage isn't available
    // we'll either have to change listen or fake message events somehow.
    start() {
        if (this._started === false) {
            this._started = true;
            const target = this._target as any;
            if (target.addEventListener) {
                target.addEventListener('message', this._messageHandler);
            }
            else if (target.attachEvent) {
                target.attachEvent('onmessage', this._messageHandler);
            }
        }
    }

    stop() {
        if (this._started) {
            this._started = false;
            const target = this._target as any;
            if (target.addEventListener) {
                target.removeEventListener('message', this._messageHandler);
            }
            else if (target.attachEvent) {
                target.detachEvent('onmessage', this._messageHandler);
            }
        }
    }

    // Get the channel and arguments and send it to the target
    // Channel is the event that the other side will be listening for
    send(channel: string, ...args: any[]): void {
        trace && console.log(`send ${channel} - ${args}`);
        const packet = CrossFrameMessage.Encode(this._uuid, channel, args);
        this._postMessage(packet);
    }

    // Cleans up event listeners
    stopListening() {
        const target = this._target as any;
        if (target.removeEventListener) {
            target.removeEventListener('message', this._messageHandler)
        }
        else if (target.detachEvent) {
            target.detachEvent('onmessage', this._messageHandler)
        }
    }

    // Unpacks and emits
    protected _eventHandler(channel: string, ...args: any[]) {
        trace && console.log(`emit ${channel} - ${args}`);
        this.emit(channel, ...args);
    }

    protected _messageHandler(event: MessageEvent) {
        const packet = CrossFrameMessage.Decode(event.data);
        if (packet) {
            const args = packet.args || [];
            this._eventHandler(packet.channel, ...args);
        }
    }
}


export class IpcBusFrameBridge extends CrossFrameEventEmitter {
    protected _ipcWindow: IpcWindow;

    constructor(ipcWindow: IpcWindow, target: Window, origin?: string) {
        super(target, origin);
        this._ipcWindow = ipcWindow;

        // Callback
        this._messageTransportHandlerEvent = this._messageTransportHandlerEvent.bind(this);
        this._messageTransportHandlerConnect = this._messageTransportHandlerConnect.bind(this);

        this._ipcWindow.on(IPCBUS_TRANSPORT_RENDERER_CONNECT, this._messageTransportHandlerConnect);
        this._ipcWindow.on(IPCBUS_TRANSPORT_RENDERER_EVENT, this._messageTransportHandlerEvent);
    }

    // Unpacks and emits
    protected _eventHandler(channel: string, ...args: any[]) {
        trace && console.log(`_eventHandler ${channel} ${args}`);
        this._ipcWindow.send(channel, ...args);
    }

    protected _messageTransportHandlerEvent(...args: any[]) {
        trace && console.log(`_messageTransportHandlerEvent ${args}`);
        this.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ...args);
    }

    protected _messageTransportHandlerConnect(...args: any[]) {
        trace && console.log(`_messageTransportHandlerConnect ${args}`);
        this.send(IPCBUS_TRANSPORT_RENDERER_CONNECT, ...args);
    }
}


