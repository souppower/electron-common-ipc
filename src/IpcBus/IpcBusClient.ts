/// <reference types='node' />

import { EventEmitter } from 'events';

import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

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

    connect(timeoutDelayOrPeerName?: number | string, peerName?: string): Promise<string> {
        let timeoutDelay: number = IpcBusUtils.IPC_BUS_TIMEOUT;
        if ((typeof timeoutDelayOrPeerName === 'number') && (timeoutDelayOrPeerName > 0)) {
            timeoutDelay = timeoutDelayOrPeerName;
        }
        else if (typeof timeoutDelayOrPeerName === 'string') {
            peerName = timeoutDelayOrPeerName;
        }
        return this._ipcBusTransport.ipcConnect(timeoutDelay, peerName);
    }

    close() {
        super.removeAllListeners();
        this._ipcBusTransport.ipcClose();
    }

    send(channel: string, ...args: any[]) {
        this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.SendMessage, channel, undefined, args);
    }

    request(timeoutDelayOrChannel: number | string, ...args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if (typeof timeoutDelayOrChannel === 'number') {
            // Exception may be raised regarding the args (length must be > 0 and have a string at 1st arg)
            return this._ipcBusTransport.request(timeoutDelayOrChannel, args[0], args.slice(1));
        }
        else {
            return this._ipcBusTransport.request(null, timeoutDelayOrChannel, args);
        }
    }

    // EventEmitter API
    addListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.addListener(channel, listener);
        this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.SubscribeChannel, channel);
        return this;
    }

    removeListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.removeListener(channel, listener);
        this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.UnsubscribeChannel, channel);
        return this;
    }

    on(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        return this.addListener(channel, listener);
    }

    once(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.once(channel, listener);
        // removeListener will be automatically called by NodeJS when callback has been triggered
        this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.SubscribeChannel, channel);
        return this;
    }

    off(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        return this.removeListener(channel, listener);
    }

    removeAllListeners(channel?: string): this {
        if (channel) {
            this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.UnsubscribeChannel, channel, {unsubscribeAll: true});
        }
        else {
            this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.UnsubscribeAllChannels, '');
        }
        super.removeAllListeners(channel);
        return this;
    }

    // Added in Node 6...
    prependListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.prependListener(channel, listener);
        this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.SubscribeChannel, channel);
        return this;
    }

    prependOnceListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.prependOnceListener(channel, listener);
        this._ipcBusTransport.ipcPushCommand(IpcBusCommand.Kind.SubscribeChannel, channel);
        return this;
    }
}
