import * as assert from 'assert';

import * as Client from '../IpcBusClient';

import { IpcBusTransportImpl } from '../IpcBusTransportImpl';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusSender } from '../IpcBusTransport';
import { 
    IPCBUS_TRANSPORT_RENDERER_CONNECT, 
    IPCBUS_TRANSPORT_RENDERER_EVENT,
 } from '../renderer/IpcBusTransportWindow';

 import { 
    IPCBUS_TRANSPORT_BRIDGE_REQUEST_INSTANCE,
    IPCBUS_TRANSPORT_BRIDGE_BROADCAST_INSTANCE
 } from './IpcBusBridgeImpl';

// Implementation for renderer process
/** @internal */
export class IpcBusTransportBridge extends IpcBusTransportImpl implements IpcBusSender {
    private _ipcMain: Electron.IpcMain;

    private _promiseConnected: Promise<void>;
    private _ipcBusBridge: IpcBusBridgeImpl;

    constructor(contextType: Client.IpcBusProcessType) {
        assert(contextType === 'main');
        super({ type: contextType, pid: process.pid });

        this._ipcMain = require('electron').ipcMain;
    }

    protected _reset() {
        this._promiseConnected = null;
        if (this._ipcBusBridge) {
            this._ipcBusBridge = null;
        }
    }

    send(channel: string, ipcBusCommand: IpcBusCommand, args: any[]) {
        if (channel === IPCBUS_TRANSPORT_RENDERER_EVENT) {
            this._onCommandReceived(undefined, ipcBusCommand, args);
        }
        else if (channel === IPCBUS_TRANSPORT_RENDERER_CONNECT) {
            this._ipcBusPeer = (ipcBusCommand as any) as Client.IpcBusPeer;
        }
    }

    /// IpcBusTransport API
    ipcConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        // Store in a local variable, in case it is set to null (paranoid code as it is asynchronous!)
        if (this._promiseConnected == null) {
            // options = IpcBusUtils.CheckConnectOptions(options);
            this._promiseConnected = new Promise<void>((resolve, reject) => {
                let timer: NodeJS.Timer;
                const replyChannel = this.generateReplyChannel();
                const replyListener = (event: Electron.IpcMainEvent, ipcBusBridge: IpcBusBridgeImpl) => {
                    clearTimeout(timer);
                    this._ipcBusBridge = ipcBusBridge;
                    this._ipcMain.removeListener(replyChannel, replyListener);
                    this._ipcMain.removeListener(IPCBUS_TRANSPORT_BRIDGE_BROADCAST_INSTANCE, replyListener);
                    this.ipcSend(IpcBusCommand.Kind.Connect, '', undefined, [options.peerName]);
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
        return this._promiseConnected;
    }

    ipcClose(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        if (this._ipcBusBridge) {
            this.ipcSend(IpcBusCommand.Kind.Close, '');
            this._reset();
        }
        return Promise.resolve();
    }

    // We serialize in renderer process to save master CPU.
    // We keep ipcBusCommand in plain text, once again to have master handling it easily
    ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        if (this._ipcBusBridge) {
            ipcBusCommand.kind = ('B' + ipcBusCommand.kind) as IpcBusCommand.Kind;
            this._ipcBusBridge._onRendererMessage({ sender: this }, ipcBusCommand, args);
        }
    }
}
