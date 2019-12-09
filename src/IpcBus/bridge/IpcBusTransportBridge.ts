import * as assert from 'assert';

import * as IpcBusUtils from '../IpcBusUtils';
import * as Client from '../IpcBusClient';

import { IpcBusTransportImpl } from '../IpcBusTransportImpl';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusSender } from '../IpcBusTransport';
import { IPCBUS_TRANSPORT_RENDERER_CONNECT, IPCBUS_TRANSPORT_RENDERER_EVENT } from '../IpcBusTransportWindow';

// Implementation for renderer process
/** @internal */
export class IpcBusTransportBridge extends IpcBusTransportImpl implements IpcBusSender {
    private _promiseConnected: Promise<void>;
    private _connected: boolean;

    constructor(contextType: Client.IpcBusProcessType) {
        assert(contextType === 'main');
        super({ type: contextType, pid: process.pid });
    }

    protected _reset() {
        this._promiseConnected = null;
        if (this._connected) {
            this._connected = false;
        }
    }

    send(channel: string, ipcBusCommand: IpcBusCommand, args: any[]) {
        if (channel === IPCBUS_TRANSPORT_RENDERER_EVENT) {
            switch (ipcBusCommand.kind) {
                case IpcBusCommand.Kind.SendMessage: {
                    this._onCommandSendMessage(ipcBusCommand, args);
                    break;
                }
                case IpcBusCommand.Kind.RequestMessage: {
                    this._onCommandRequestMessage(ipcBusCommand, args);
                    break;
                }
                case IpcBusCommand.Kind.RequestResponse: {
                    this._onCommandRequestResponse(ipcBusCommand, args);
                    break;
                }
            }
        }
        else if (channel === IPCBUS_TRANSPORT_RENDERER_CONNECT) {
            this._ipcBusPeer = args[0];
        }
    }

    /// IpcBusTrandport API
    ipcConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        // Store in a local variable, in case it is set to null (paranoid code as it is asynchronous!)
        let p = this._promiseConnected;
        if (!p) {
            options = IpcBusUtils.CheckConnectOptions(options);
            p = this._promiseConnected = new Promise<void>((resolve, reject) => {
                if (IpcBusBridgeImpl.Instance) {
                    this._connected = true;
                    this.ipcSend(IpcBusCommand.Kind.Connect, '', undefined, [options.peerName]);
                    return resolve();
                }
                else {
                    this._connected = false;
                    return reject();
                }
            });
        }
        return p;
    }

    ipcClose(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        if (this._connected) {
            this.ipcSend(IpcBusCommand.Kind.Close, '');
            this._reset();
        }
        return Promise.resolve();
    }

    // We serialize in renderer process to save master CPU.
    // We keep ipcBusCommand in plain text, once again to have master handling it easily
    ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        if (this._connected) {
            ipcBusCommand.kind = ('B' + ipcBusCommand.kind) as IpcBusCommand.Kind;
            IpcBusBridgeImpl.Instance._onRendererMessage(this, ipcBusCommand, args);
        }
    }
}
