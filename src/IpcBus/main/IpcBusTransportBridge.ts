import { EventEmitter } from 'events';
import * as assert from 'assert';

import * as Client from '../IpcBusClient';

import { IpcWindow } from './IpcBusTransportIpc';
import { IpcBusTransportIpc } from './IpcBusTransportIpc';

import {
    IPCBUS_TRANSPORT_BRIDGE_REQUEST_INSTANCE,
    IPCBUS_TRANSPORT_BRIDGE_BROADCAST_INSTANCE
} from './IpcBusBridgeImpl';
import { IpcBusSender } from '../IpcBusTransport';

export class IpcMainHandler extends EventEmitter implements IpcWindow {
    private _ipcMain: Electron.IpcMain;
    private _sender: IpcBusSender;
    private _pendingMessages: [string, any[]][];

    constructor() {
        super();
        this._ipcMain = require('electron').ipcMain;
        this._pendingMessages = [];

        const replyListener = (event: Electron.IpcMainEvent) => {
            this._ipcMain.removeListener(IPCBUS_TRANSPORT_BRIDGE_BROADCAST_INSTANCE, replyListener);
            this.removeListener(IPCBUS_TRANSPORT_BRIDGE_BROADCAST_INSTANCE, replyListener);
            const pendingMessages = this._pendingMessages;
            this._pendingMessages = null;
            pendingMessages.forEach(args => {
                this.send(...args);
            });
        };
        this._ipcMain.addListener(IPCBUS_TRANSPORT_BRIDGE_BROADCAST_INSTANCE, replyListener);
        this.addListener(IPCBUS_TRANSPORT_BRIDGE_BROADCAST_INSTANCE, replyListener);

        const self = this;
        this._sender = {
            send: (channel: string, ...args: any) => {
                self.emit(channel, ...args);
            }
        }

        // We wait for the bridge confirmation
        this._ipcMain.emit(IPCBUS_TRANSPORT_BRIDGE_REQUEST_INSTANCE, { sender: this._sender });
    }

    send(channel: string, ...args: any[]) {
        if (this._pendingMessages) {
            this._pendingMessages.push([channel, args]);
        }
        else {
            this._ipcMain.emit(channel, { sender: this._sender }, ...args)
        }
    }
}

// Implementation for renderer process
/** @internal */
export class IpcBusTransportBridge extends IpcBusTransportIpc {
    constructor(contextType: Client.IpcBusProcessType, ipcWindow: IpcWindow) {
        assert(contextType === 'main');
        super({ type: contextType, pid: process.pid }, ipcWindow);
    }
}
