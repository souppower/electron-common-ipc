/// <reference types='node' />

import { EventEmitter } from 'events';

import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusTransport } from './IpcBusTransport';
import { IpcBusCommand } from './IpcBusCommand';


// Implementation for a common IpcBusClient
/** @internal */
export class IpcBusCommonClient extends EventEmitter
                                implements IpcBusInterfaces.IpcBusClient {
    protected _ipcBusTransport: IpcBusTransport;

    constructor(ipcBusTransport: IpcBusTransport) {
        super();
        super.setMaxListeners(0);
        this._ipcBusTransport = ipcBusTransport;
        this._ipcBusTransport.eventEmitter = this;
    }

    // IpcBusClient API
    get peer(): IpcBusInterfaces.IpcBusPeer {
        return this._ipcBusTransport.peer;
    }

    connect(options?: IpcBusInterfaces.IpcBusClient.ConnectOptions): Promise<string> {
        return this._ipcBusTransport.ipcConnect(options);
    }

    close(options?: IpcBusInterfaces.IpcBusClient.CloseOptions) {
        super.removeAllListeners();
        return this._ipcBusTransport.ipcClose(options);
    }

    send(channel: string, ...args: any[]) {
        this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.SendMessage, channel, undefined, args);
    }

    request(channel: string, timeoutDelay: number, ...args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        return this._ipcBusTransport.request(channel, timeoutDelay, args);
    }

    // EventEmitter API
    addListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.addListener(channel, listener);
        this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }

    removeListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.removeListener(channel, listener);
        this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.RemoveChannelListener, channel);
        return this;
    }

    on(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        return this.addListener(channel, listener);
    }

    once(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.once(channel, listener);
        // removeListener will be automatically called by NodeJS when callback has been triggered
        this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }

    off(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        return this.removeListener(channel, listener);
    }

    removeAllListeners(channel?: string): this {
        if (channel) {
            this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.RemoveChannelAllListeners, channel);
        }
        else {
            this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.RemoveListeners, '');
        }
        super.removeAllListeners(channel);
        return this;
    }

    // Added in Node 6...
    prependListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.prependListener(channel, listener);
        this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }

    prependOnceListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.prependOnceListener(channel, listener);
        this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }
}
