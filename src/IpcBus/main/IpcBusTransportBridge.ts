import * as assert from 'assert';
import { IpcPacketBuffer } from 'socket-serializer';

import * as Client from '../IpcBusClient';

import { IpcBusTransportImpl } from '../IpcBusTransportImpl';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusSender } from '../IpcBusTransport';

 import { 
    IPCBUS_TRANSPORT_BRIDGE_REQUEST_INSTANCE,
    IPCBUS_TRANSPORT_BRIDGE_BROADCAST_INSTANCE
 } from './IpcBusBridgeImpl';

// Implementation for renderer process
/** @internal */
export class IpcBusTransportBridge extends IpcBusTransportImpl implements IpcBusSender {
    private _ipcMain: Electron.IpcMain;

    private _ipcBusBridge: IpcBusBridgeImpl;
    private _packetOut: IpcPacketBuffer;

    constructor(contextType: Client.IpcBusProcessType) {
        assert(contextType === 'main');
        super({ type: contextType, pid: process.pid });

        this._ipcMain = require('electron').ipcMain;
        this._packetOut = new IpcPacketBuffer();
    }

    protected _reset() {
        this._promiseConnected = null;
        if (this._ipcBusBridge) {
            this._ipcBusBridge = null;
        }
    }

    send(channel: string, ipcBusCommand: IpcBusCommand, buffer: Buffer) {
        // if (channel === IPCBUS_TRANSPORT_RENDERER_EVENT) {
            this._onCommandBufferReceived(undefined, ipcBusCommand, buffer);
        // }
    }

    /// IpcBusTransport API
    ipcHandshake(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let timer: NodeJS.Timer;
            const replyChannel = this.generateReplyChannel();
            const replyListener = (event: Electron.IpcMainEvent, ipcBusBridge: IpcBusBridgeImpl) => {
                clearTimeout(timer);
                this._ipcBusBridge = ipcBusBridge;
                this._ipcMain.removeListener(replyChannel, replyListener);
                this._ipcMain.removeListener(IPCBUS_TRANSPORT_BRIDGE_BROADCAST_INSTANCE, replyListener);
                return resolve();
            };
            this._ipcMain.addListener(replyChannel, replyListener);
            this._ipcMain.addListener(IPCBUS_TRANSPORT_BRIDGE_BROADCAST_INSTANCE, replyListener);

            // Below zero = infinite
            if (options.timeoutDelay >= 0) {
                timer = setTimeout(() => {
                    timer = null;
                    this._promiseConnected = null;
                    this._ipcMain.removeListener(replyChannel, replyListener);
                    this._ipcMain.removeListener(IPCBUS_TRANSPORT_BRIDGE_BROADCAST_INSTANCE, replyListener);
                    this._reset();
                    reject('timeout');
                }, options.timeoutDelay);
            }
            // We wait for the bridge confirmation
            this._ipcMain.emit(IPCBUS_TRANSPORT_BRIDGE_REQUEST_INSTANCE, { sender: this }, replyChannel);
        });
    }

    ipcClose(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        if (this._ipcBusBridge) {
            this.ipcSend(IpcBusCommand.Kind.Close, '');
            this._reset();
        }
        return Promise.resolve();
    }

    // We keep ipcBusCommand in plain text, once again to have master handling it easily
    ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        if (this._ipcBusBridge) {
            ipcBusCommand.kind = ('B' + ipcBusCommand.kind) as IpcBusCommand.Kind;
            if (args) {
                this._packetOut.serializeArray([ipcBusCommand, args]);
            }
            else {
                this._packetOut.serializeArray([ipcBusCommand]);
            }
            this._ipcBusBridge._onMainMessage(this, ipcBusCommand, this._packetOut.buffer);
        }
    }
}
