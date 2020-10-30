import { EventEmitter } from 'events';
import * as shortid from 'shortid';

import * as Client from './IpcBusClient';

import { IpcBusTransport } from './IpcBusTransport';
import * as IpcBusUtils from './IpcBusUtils';

// Implementation for a common IpcBusClient
/** @internal */
export class IpcBusClientImpl extends EventEmitter implements Client.IpcBusClient, IpcBusTransport.Client {
    protected _peer: Client.IpcBusPeer;
    protected _transport: IpcBusTransport;

    protected _connectCloseState: IpcBusUtils.ConnectCloseState<void>;

    constructor(transport: IpcBusTransport) {
        super();
        super.setMaxListeners(0);
        this._transport = transport;
        this._connectCloseState = new IpcBusUtils.ConnectCloseState<void>();
    }

    get peer(): Client.IpcBusPeer | null {
        return this._peer;
    }

    connect(arg1: Client.IpcBusClient.ConnectOptions | string | number, arg2?: Client.IpcBusClient.ConnectOptions | string, arg3?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return this._connectCloseState.connect(() => {
            const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
            return this._transport.connect(this, options)
            .then((peer) => {
                this._peer = peer;
                const eventNames = this.eventNames();
                for (let i = 0, l = eventNames.length; i < l; ++i) {
                    const eventName = eventNames[i] as string;
                    this._transport.addChannel(this, eventName, this.listenerCount(eventName));
                }
            });
        });
    }

    close(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        return this._connectCloseState.close(() => {
            this._transport.removeChannel(this);
            return this._transport.close(this, options)
            .then(() => {
                this._peer = null;
            });
        });
    }

    createDirectChannel(): string {
        return IpcBusUtils.CreateDirectChannel(this._peer, shortid.generate());
    }

    send(channel: string, ...args: any[]): boolean {
        // in nodejs eventEmitter, undefined is converted to 'undefined'
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.sendMessage(this, channel, args);
        return this._connectCloseState.connected;
    }

    request(channel: string, timeoutDelay: number, ...args: any[]): Promise<Client.IpcBusRequestResponse> {
        channel = IpcBusUtils.CheckChannel(channel);
        return this._transport.requestMessage(this, channel, timeoutDelay, args);
    }

    emit(event: string, ...args: any[]): boolean {
        event = IpcBusUtils.CheckChannel(event);
        this._transport.sendMessage(this, event, args);
        return this._connectCloseState.connected;
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
