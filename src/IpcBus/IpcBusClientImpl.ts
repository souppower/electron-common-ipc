import { EventEmitter } from 'events';

import * as Client from './IpcBusClient';

import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusTransport } from './IpcBusTransport';
import * as IpcBusUtils from './IpcBusUtils';

// Implementation for a common IpcBusClient
/** @internal */
export class IpcBusClientImpl extends EventEmitter implements Client.IpcBusClient {
    protected _transport: IpcBusTransport;

    constructor(transport: IpcBusTransport) {
        super();
        super.setMaxListeners(0);
        this._transport = transport;
    }

    get peer(): Client.IpcBusPeer {
        return this._transport.peer;
    }

    connect(arg1: Client.IpcBusClient.ConnectOptions | string | number, arg2?: Client.IpcBusClient.ConnectOptions | string, arg3?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
        return this._transport.ipcConnect(this, options);
    }

    close(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        super.removeAllListeners();
        return this._transport.ipcClose(this, options);
    }

    send(channel: string, ...args: any[]) {
        this._transport.ipcSendMessage(channel, args);
    }

    request(channel: string, timeoutDelay: number, ...args: any[]): Promise<Client.IpcBusRequestResponse> {
        return this._transport.ipcRequestMessage(channel, timeoutDelay, args);
    }

    emit(event: string, ...args: any[]): boolean {
        this._transport.ipcSendMessage(event, args);
        return true;
    }

    addListener(channel: string, listener: Client.IpcBusListener): this {
        this._transport.ipcPost(IpcBusCommand.Kind.AddChannelListener, channel);
        return super.addListener(channel, listener);
    }

    removeListener(channel: string, listener: Client.IpcBusListener): this {
        this._transport.ipcPost(IpcBusCommand.Kind.RemoveChannelListener, channel);
        return super.removeListener(channel, listener);
    }

    on(channel: string, listener: Client.IpcBusListener): this {
        return this.addListener(channel, listener);
    }

    once(channel: string, listener: Client.IpcBusListener): this {
        // removeListener will be automatically called by NodeJS when callback has been triggered
        this._transport.ipcPost(IpcBusCommand.Kind.AddChannelListener, channel);
        return super.once(channel, listener);
    }

    off(channel: string, listener: Client.IpcBusListener): this {
        return this.removeListener(channel, listener);
    }

    removeAllListeners(channel?: string): this {
        if (channel) {
            this._transport.ipcPost(IpcBusCommand.Kind.RemoveChannelAllListeners, channel);
        }
        else {
            this._transport.ipcPost(IpcBusCommand.Kind.RemoveListeners, '');
        }
        return super.removeAllListeners(channel);
    }

    // Added in Node 6...
    prependListener(channel: string, listener: Client.IpcBusListener): this {
        this._transport.ipcPost(IpcBusCommand.Kind.AddChannelListener, channel);
        return super.prependListener(channel, listener);
    }

    prependOnceListener(channel: string, listener: Client.IpcBusListener): this {
        this._transport.ipcPost(IpcBusCommand.Kind.AddChannelListener, channel);
        return super.prependOnceListener(channel, listener);
    }
}
