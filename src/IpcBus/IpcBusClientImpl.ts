/// <reference types='node' />

import { EventEmitter } from 'events';

import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusCommand } from './IpcBusCommand';

// Implementation for a common IpcBusClient
/** @internal */
export abstract class IpcBusClientImpl extends EventEmitter implements IpcBusInterfaces.IpcBusClient {
    constructor(options: IpcBusInterfaces.IpcBusClient.CreateOptions) {
        super();
        super.setMaxListeners(0);
    }

    readonly peer: IpcBusInterfaces.IpcBusPeer;

    connect(options?: IpcBusInterfaces.IpcBusClient.ConnectOptions): Promise<void> {
        return this.ipcConnect(options);
    }

    close(options?: IpcBusInterfaces.IpcBusClient.CloseOptions): Promise<void> {
        super.removeAllListeners();
        return this.ipcClose(options);
    }

    send(channel: string, ...args: any[]) {
        this.ipcSend(IpcBusCommand.Kind.SendMessage, channel, undefined, args);
    }

    request(channel: string, timeoutDelay: number, ...args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        return this.ipcRequest(channel, timeoutDelay, args);
    }

    // EventEmitter API
    addListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.addListener(channel, listener);
        this.ipcSend(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }

    removeListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.removeListener(channel, listener);
        this.ipcSend(IpcBusCommand.Kind.RemoveChannelListener, channel);
        return this;
    }

    on(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        return this.addListener(channel, listener);
    }

    once(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.once(channel, listener);
        // removeListener will be automatically called by NodeJS when callback has been triggered
        this.ipcSend(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }

    off(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        return this.removeListener(channel, listener);
    }

    removeAllListeners(channel?: string): this {
        super.removeAllListeners(channel);
        if (channel) {
            this.ipcSend(IpcBusCommand.Kind.RemoveChannelAllListeners, channel);
        }
        else {
            this.ipcSend(IpcBusCommand.Kind.RemoveListeners, '');
        }
        return this;
    }

    // Added in Node 6...
    prependListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.prependListener(channel, listener);
        this.ipcSend(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }

    prependOnceListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.prependOnceListener(channel, listener);
        this.ipcSend(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }

    // Transport API
    protected abstract ipcConnect(options: IpcBusInterfaces.IpcBusClient.ConnectOptions): Promise<void>;
    protected abstract ipcClose(options?: IpcBusInterfaces.IpcBusClient.CloseOptions): Promise<void>;
    protected abstract ipcRequest(channel: string, timeoutDelay: number, args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse>
    protected abstract ipcSend(kind: IpcBusCommand.Kind, channel: string, ipcBusCommandRequest?: IpcBusCommand.Request, args?: any[]): void;
}
