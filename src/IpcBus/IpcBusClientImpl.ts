import { EventEmitter } from 'events';

import * as Client from './IpcBusClient';

import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusTransport } from './IpcBusTransport';
import * as IpcBusUtils from './IpcBusUtils';

// Implementation for a common IpcBusClient
/** @internal */
export class IpcBusClientImpl extends EventEmitter implements Client.IpcBusClient {
    protected _transport: IpcBusTransport;

    constructor(ipcBusClientTransport: IpcBusTransport) {
        super();
        super.setMaxListeners(0);
        this._transport = ipcBusClientTransport;
        this._transport.ipcCallback((channel, ipcBusEvent, ...args) => {
            super.emit(channel, ipcBusEvent, ...args);
        });
    }

    get peer(): Client.IpcBusPeer {
        return this._transport.peer;
    }

    connect(arg1: Client.IpcBusClient.ConnectOptions | string | number, arg2?: Client.IpcBusClient.ConnectOptions | string, arg3?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
        return this._transport.ipcConnect(options);
    }

    close(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        super.removeAllListeners();
        return this._transport.ipcClose(options);
    }

    send(channel: string, ...args: any[]) {
        this._transport.ipcSend(IpcBusCommand.Kind.SendMessage, channel, undefined, args);
    }

    request(channel: string, timeoutDelay: number, ...args: any[]): Promise<Client.IpcBusRequestResponse> {
        return this._transport.ipcRequest(channel, timeoutDelay, args);
    }

    emit(event: string, ...args: any[]): boolean {
        this._transport.ipcSend(IpcBusCommand.Kind.SendMessage, event, undefined, args);
        return true;
    }

    addListener(channel: string, listener: Client.IpcBusListener): this {
        super.addListener(channel, listener);
        this._transport.ipcSend(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }

    removeListener(channel: string, listener: Client.IpcBusListener): this {
        super.removeListener(channel, listener);
        this._transport.ipcSend(IpcBusCommand.Kind.RemoveChannelListener, channel);
        return this;
    }

    on(channel: string, listener: Client.IpcBusListener): this {
        return this.addListener(channel, listener);
    }

    once(channel: string, listener: Client.IpcBusListener): this {
        super.once(channel, listener);
        // removeListener will be automatically called by NodeJS when callback has been triggered
        this._transport.ipcSend(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }

    off(channel: string, listener: Client.IpcBusListener): this {
        return this.removeListener(channel, listener);
    }

    removeAllListeners(channel?: string): this {
        super.removeAllListeners(channel);
        if (channel) {
            this._transport.ipcSend(IpcBusCommand.Kind.RemoveChannelAllListeners, channel);
        }
        else {
            this._transport.ipcSend(IpcBusCommand.Kind.RemoveListeners, '');
        }
        return this;
    }

    // Added in Node 6...
    prependListener(channel: string, listener: Client.IpcBusListener): this {
        super.prependListener(channel, listener);
        this._transport.ipcSend(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }

    prependOnceListener(channel: string, listener: Client.IpcBusListener): this {
        super.prependOnceListener(channel, listener);
        this._transport.ipcSend(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }
}
