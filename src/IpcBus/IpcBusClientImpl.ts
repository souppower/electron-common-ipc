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
            this._waitForConnected = this._waitForClosed
            .then(() => {
                const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
                return this._transport.connect(this, options)
            })
            .then((peer) => {
                this._peer = peer;
                const eventNames = this.eventNames();
                for (let i = 0, l = eventNames.length; i < l; ++i) {
                    const eventName = eventNames[i] as string;
                    this._transport.addChannel(this, eventName, this.listenerCount(eventName));
                }
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
                this._transport.removeChannel(this);
                return this._transport.close(this, options);
            })
            .then(() => {
                this._peer = null;
            });
        }
        return this._waitForClosed;
    }

    send(channel: string, ...args: any[]): boolean {
        // in nodejs eventEmitter, undefined is converted to 'undefined'
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.sendMessage(this, channel, args);
        return (this._waitForConnected != null);
    }

    request(channel: string, timeoutDelay: number, ...args: any[]): Promise<Client.IpcBusRequestResponse> {
        channel = IpcBusUtils.CheckChannel(channel);
        return this._transport.requestMessage(this, channel, timeoutDelay, args);
    }

    emit(event: string, ...args: any[]): boolean {
        event = IpcBusUtils.CheckChannel(event);
        this._transport.sendMessage(this, event, args);
        return (this._waitForConnected != null);
    }
 
    on(channel: string, listener: Client.IpcBusListener): this {
        return this.addListener(channel, listener);
    }

    off(channel: string, listener: Client.IpcBusListener): this {
        return this.removeListener(channel, listener);
    }

    addListener(channel: string, listener: Client.IpcBusListener): this {
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.addChannel(this, channel);
        return super.addListener(channel, listener);
    }

    removeListener(channel: string, listener: Client.IpcBusListener): this {
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.removeChannel(this, channel);
        return super.removeListener(channel, listener);
    }

    once(channel: string, listener: Client.IpcBusListener): this {
        // removeListener will be automatically called by NodeJS when callback has been triggered
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.addChannel(this, channel);
        return super.once(channel, listener);
    }

    removeAllListeners(channel?: string): this {
        if (arguments.length === 1) {
            channel = IpcBusUtils.CheckChannel(channel);
        }
        this._transport.removeChannel(this, channel);
        return super.removeAllListeners(channel);
    }

    // Added in Node 6...
    prependListener(channel: string, listener: Client.IpcBusListener): this {
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.addChannel(this, channel);
        return super.prependListener(channel, listener);
    }

    prependOnceListener(channel: string, listener: Client.IpcBusListener): this {
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.addChannel(this, channel);
        return super.prependOnceListener(channel, listener);
    }
}
