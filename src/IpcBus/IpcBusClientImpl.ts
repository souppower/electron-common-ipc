import { EventEmitter } from 'events';

import * as Client from './IpcBusClientInterfaces';

import { IpcBusCommand } from './IpcBusCommand';

// Implementation for a common IpcBusClient
/** @internal */
export abstract class IpcBusClientImpl extends EventEmitter implements Client.IpcBusClient {
    constructor(options: Client.IpcBusClient.CreateOptions) {
        super();
        super.setMaxListeners(0);
    }

    readonly peer: Client.IpcBusPeer;

    connect(options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return this.ipcConnect(options);
    }

    close(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        super.removeAllListeners();
        return this.ipcClose(options);
    }

    send(channel: string, ...args: any[]) {
        this.ipcSend(IpcBusCommand.Kind.SendMessage, channel, undefined, args);
    }

    request(channel: string, timeoutDelay: number, ...args: any[]): Promise<Client.IpcBusRequestResponse> {
        return this.ipcRequest(channel, timeoutDelay, args);
    }

    // EventEmitter API
    protected native_emit(event: string | symbol, ...args: any[]): boolean {
        return super.emit(event, ...args);
    }

    emit(event: string, ...args: any[]): boolean {
        this.ipcSend(IpcBusCommand.Kind.SendMessage, event, undefined, args);
        return true;
    }

    addListener(channel: string, listener: Client.IpcBusListener): this {
        super.addListener(channel, listener);
        this.ipcSend(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }

    removeListener(channel: string, listener: Client.IpcBusListener): this {
        super.removeListener(channel, listener);
        this.ipcSend(IpcBusCommand.Kind.RemoveChannelListener, channel);
        return this;
    }

    on(channel: string, listener: Client.IpcBusListener): this {
        return this.addListener(channel, listener);
    }

    once(channel: string, listener: Client.IpcBusListener): this {
        super.once(channel, listener);
        // removeListener will be automatically called by NodeJS when callback has been triggered
        this.ipcSend(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }

    off(channel: string, listener: Client.IpcBusListener): this {
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
    prependListener(channel: string, listener: Client.IpcBusListener): this {
        super.prependListener(channel, listener);
        this.ipcSend(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }

    prependOnceListener(channel: string, listener: Client.IpcBusListener): this {
        super.prependOnceListener(channel, listener);
        this.ipcSend(IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }

    // Transport API
    protected abstract ipcConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void>;
    protected abstract ipcClose(options?: Client.IpcBusClient.CloseOptions): Promise<void>;
    protected abstract ipcRequest(channel: string, timeoutDelay: number, args: any[]): Promise<Client.IpcBusRequestResponse>
    protected abstract ipcSend(kind: IpcBusCommand.Kind, channel: string, ipcBusCommandRequest?: IpcBusCommand.Request, args?: any[]): void;
}
