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

    addListener(channel: string, listener: Client.IpcBusListener): this {
        this._transport.ipcAddChannelListener(this, channel);
        return super.addListener(channel, listener);
    }

    removeListener(channel: string, listener: Client.IpcBusListener): this {
        this._transport.ipcRemoveChannelListener(this, channel);
        return super.removeListener(channel, listener);
    }

    on(channel: string, listener: Client.IpcBusListener): this {
        return this.addListener(channel, listener);
    }

    once(channel: string, listener: Client.IpcBusListener): this {
        // removeListener will be automatically called by NodeJS when callback has been triggered
        this._transport.ipcAddChannelListener(this, channel);
        return super.once(channel, listener);
    }

    off(channel: string, listener: Client.IpcBusListener): this {
        return this.removeListener(channel, listener);
    }

    removeAllListeners(channel?: string): this {
        this._transport.ipcRemoveAllListeners(this, channel);
        return super.removeAllListeners(channel);
    }

    // Added in Node 6...
    prependListener(channel: string, listener: Client.IpcBusListener): this {
        this._transport.ipcAddChannelListener(this, channel);
        return super.prependListener(channel, listener);
    }

    prependOnceListener(channel: string, listener: Client.IpcBusListener): this {
        this._transport.ipcAddChannelListener(this, channel);
        return super.prependOnceListener(channel, listener);
    }
}
