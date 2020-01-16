import { EventEmitter } from 'events';

import * as Client from './IpcBusClient';

import { IpcBusTransport } from './IpcBusTransport';
import * as IpcBusUtils from './IpcBusUtils';

// Implementation for a common IpcBusClient
/** @internal */
export class IpcBusClientImpl extends EventEmitter implements Client.IpcBusClient, IpcBusTransport.Client {
    protected _peer: Client.IpcBusPeer;
    protected _transport: IpcBusTransport;
    protected _waitForConnected: Promise<void>;
    protected _waitForClosed: Promise<void>;

    constructor(transport: IpcBusTransport) {
        super();
        super.setMaxListeners(0);
        this._transport = transport;
        this._waitForClosed = Promise.resolve();

        this._newListener = this._newListener.bind(this);
        this._removeListener = this._removeListener.bind(this);
    }

    protected _newListener(event: string, listener: Function) {
        if (this.listenerCount(event) === 1) {
            this._transport.ipcAddChannels(this, [event]);
        }
    }

    protected _removeListener(event: string, listener: Function) {
        if (this.listenerCount(event) === 0) {
            this._transport.ipcRemoveChannels(this, [event]);
        }
    }

    get peer(): Client.IpcBusPeer | null {
        return this._peer;
    }

    connect(arg1: Client.IpcBusClient.ConnectOptions | string | number, arg2?: Client.IpcBusClient.ConnectOptions | string, arg3?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        if (this._waitForConnected == null) {
            const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
            this._waitForConnected = this._waitForClosed
            .then(() => {
                return this._transport.ipcConnect(this, options)
            })
            .then((peer) => {
                this._peer = peer;
                this._transport.ipcAddChannels(this, this.eventNames() as string[])
                super.addListener('newListener', this._newListener);
                super.addListener('removeListener', this._removeListener);
            });
        }
        return this._waitForConnected;
    }

    close(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        if (this._waitForConnected) {
            const waitForConnected = this._waitForConnected;
            this._waitForConnected = null;
            this._waitForClosed = waitForConnected
            .then(() => {
                super.removeListener('newListener', this._newListener);
                super.removeListener('removeListener', this._removeListener);
                this._transport.ipcRemoveChannels(this, this.eventNames() as string[])
                return this._transport.ipcClose(this, options);
            })
            .then(() => {
                this._peer = null;
            });
        }
        return this._waitForClosed;
    }

    send(channel: string, ...args: any[]) {
        this._transport.ipcSendMessage(this, channel, args);
    }

    request(channel: string, timeoutDelay: number, ...args: any[]): Promise<Client.IpcBusRequestResponse> {
        return this._transport.ipcRequestMessage(this, channel, timeoutDelay, args);
    }

    emit(event: string, ...args: any[]): boolean {
        this._transport.ipcSendMessage(this, event, args);
        return true;
    }

    on(channel: string, listener: Client.IpcBusListener): this {
        return this.addListener(channel, listener);
    }

    off(channel: string, listener: Client.IpcBusListener): this {
        return this.removeListener(channel, listener);
    }
}
