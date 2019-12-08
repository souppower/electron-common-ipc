// Constants
import { EventEmitter } from 'events';

import { IpcConnectOptions } from './IpcBusClient';

export const IPC_BUS_TIMEOUT = 20000;// 2000;

const win32prefix1 = '\\\\.\\pipe';
const win32prefix2 = '\\\\?\\pipe';

// https://nodejs.org/api/net.html#net_ipc_support
function CleanPipeName(str: string) {
    if (process.platform === 'win32') {
        if ((str.lastIndexOf(win32prefix1, 0) === -1) && (str.lastIndexOf(win32prefix2, 0) === -1)) {
            str = str.replace(/^\//, '');
            str = str.replace(/\//g, '-');
            str = win32prefix1 + '\\' + str;
        }
    }
    return str;
}

export function CheckConnectOptions<T extends IpcConnectOptions>(arg1: T | string | number, arg2?: T | string, arg3?: T): T | null {
    // A port number : 59233, 42153
    // A port number + hostname : 59233, '127.0.0.1'
    let options: T = (typeof arg1 === 'object' ? arg1 : typeof arg2 === 'object' ? arg2 : typeof arg3 === 'object' ? arg3: {}) as T; 
    if (Number(arg1) >= 0) {
        options.port = Number(arg1);
        options.host = typeof arg2 === 'string' ? arg2 : undefined;
    }
    // A 'hostname:port' pattern : 'localhost:8082'
    // A path : '//local-ipc'
    else if (typeof arg1 === 'string') {
        const parts = arg1.split(':');
        if ((parts.length === 2) && (Number(parts[1]) >= 0)) {
            options.port = Number(parts[1]);
            options.host = parts[0];
        }
        else {
            options.path = CleanPipeName(arg1);
        }
    }
    // An IpcNetOptions object similar to NodeJS.net.ListenOptions
    else if (typeof arg1 === 'object') {
        if (options.path) {
            options.path =  CleanPipeName(arg1.path);
        }
    }
    if ((options.port == null && options.path == null)) {
        return null;
    }
    if (options.timeoutDelay == null) {
        options.timeoutDelay = IPC_BUS_TIMEOUT;
    }
    return options;
}

function JSON_stringify_array(data: any[], maxLen: number, output: string): string {
    output += '[';
    for (let i = 0, l = data.length; i < l; ++i) {
        if (output.length >= maxLen) {
            output += '\'__cut__\'';
            break;
        }
        output += JSON_stringify(data[i], maxLen - output.length);
        output += ',';
    }
    output += ']';
    return output;
}

function JSON_stringify_object(data: any, maxLen: number, output: string): string {
    output += '{';
    if (data) {
        const keys = Object.keys(data);
        for (let i = 0, l = keys.length; i < l; ++i) {
            if (output.length >= maxLen) {
                output += '\'__cut__\'';
                break;
            }
            const key = keys[i];
            output += key + ': ';
            if (output.length >= maxLen) {
                output += '\'__cut__\'';
                break;
            }
            output += JSON_stringify(data[key], maxLen - output.length);
            output += ',';
        }
    }
    else {
        output += 'null';
    }
    output += '}';
    return output;
}

export function JSON_stringify(data: any, maxLen: number): string {
    let output = '';
    switch (typeof data) {
        case 'object':
            if (Buffer.isBuffer(data)) {
                output = data.toString('utf8', 0, maxLen);
            }
            else if (Array.isArray(data)) {
                output = JSON_stringify_array(data, maxLen, output);
            }
            else if (data instanceof Date) {
                output = data.toISOString();
            }
            else {
                output = JSON_stringify_object(data, maxLen, output);
            }
            break;
        case 'string':
            output = data.substr(0, maxLen);
            break;
        case 'number':
            output = data.toString();
            break;
        case 'boolean':
            output = data ? 'true' : 'false';
            break;
        case 'undefined':
            break;
    }
    return output;
}


/** @internal */
export class Logger {
    static enable: boolean = false;
    static service: boolean = false;

    static info(msg: string) {
        console.log(msg);
    }

    static warn(msg: string) {
        console.warn(msg);
    }

    static error(msg: string) {
        console.error(msg);
    }
};

export function ContainsWildCards(str: string): boolean {
    // return str.includes('*') || str.includes('?');
    return str.charAt(str.length - 1) === '*';
}

export function WildCardsToRegex(str: string): RegExp {
    return new RegExp(preg_quote(str).replace(/\\\*/g, '.*').replace(/\\\?/g, '.'), 'g');
}

function preg_quote(str: string): string {
    // http://kevin.vanzonneveld.net
    // +   original by: booeyOH
    // +   improved by: Ates Goral (http://magnetiq.com)
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   bugfixed by: Onno Marsman
    // +   improved by: Brett Zamir (http://brett-zamir.me)
    // *     example 1: preg_quote("$40");
    // *     returns 1: '\$40'
    // *     example 2: preg_quote("*RRRING* Hello?");
    // *     returns 2: '\*RRRING\* Hello\?'
    // *     example 3: preg_quote("\\.+*?[^]$(){}=!<>|:");
    // *     returns 3: '\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:'
    return str.replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\-]', 'g'), '\\$&');
}

// Structure
// Channel has key
// then list of "transports" for this channel: key + implem (socket or webContents)
// then list of ref counted peerIds for this transport

/** @internal */
export class ChannelConnectionMap<T1> extends EventEmitter {
    private _name: string;
    private _channelsMap: Map<string, Map<T1, ConnectionData<T1>>>;
    private _requestChannels: Map<string, T1>;
    private _emitter: boolean;

    constructor(name: string, emitter: boolean) {
        super();
        this._name = name;
        this._emitter = emitter;
        this._channelsMap = new Map<string, Map<T1, ConnectionData<T1>>>();
        this._requestChannels = new Map<string, T1>();
    }

    private _info(str: string) {
        Logger.enable && Logger.info(`[${this._name}] ${str}`);
    }

    private _warn(str: string) {
        Logger.enable && Logger.warn(`[${this._name}] ${str}`);
    }

    // private _error(str: string) {
    //     Logger.enable && Logger.error(`[${this._name}] ${str}`);
    // }

    setRequestChannel(channel: string, conn: T1): void {
        this._requestChannels.set(channel, conn);
    }

    getRequestChannel(channel: string): T1 {
        return this._requestChannels.get(channel);
    }

    deleteRequestChannel(channel: string): boolean {
        return this._requestChannels.delete(channel);
    }

    hasChannel(channel: string): boolean {
        return this._channelsMap.has(channel);
    }

    clear() {
        this._channelsMap.clear();
        this._requestChannels.clear();
    }

    addRef(channel: string, conn: T1, peerId: string): number {
        let channelAdded = false;
        Logger.enable && this._info(`AddRef: '${channel}', peerId = ${peerId}`);

        let connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            channelAdded = true;
            connsMap = new Map<T1, ConnectionData<T1>>();
            // This channel has NOT been subscribed yet, add it to the map
            this._channelsMap.set(channel, connsMap);
            // Logger.enable && this._info(`AddRef: channel '${channel}' is added`);
        }
        let connData = connsMap.get(conn);
        if (connData == null) {
            // This channel has NOT been already subscribed by this connection
            connData = new ConnectionData<T1>(conn, peerId);
            connsMap.set(conn, connData);
            // Logger.enable && this._info(`AddRef: connKey = ${conn} is added`);
        }
        else {
            connData.addPeerId(peerId);
        }
        Logger.enable && this._info(`AddRef: '${channel}', count = ${connData.peerIds.size}`);
        if (channelAdded) {
            this._emitter && this.emit('channel-added', channel);
        }
        return connsMap.size;
    }

    private _releaseConnData(channel: string, conn: T1, connsMap: Map<T1, ConnectionData<T1>>, peerId: string, all: boolean): number {
        let channelRemoved = false;
        const connData = connsMap.get(conn);
        if (connData == null) {
            Logger.enable && this._warn(`Release '${channel}': conn is unknown`);
            return 0;
        }
        else {
            if (peerId == null) {
                connData.clearPeerIds();
            }
            else {
                if (all) {
                    if (connData.removePeerId(peerId) === false) {
                        Logger.enable && this._warn(`Release '${channel}': peerId #${peerId} is unknown`);
                    }
                }
                else {
                    connData.releasePeerId(peerId);
                }
            }
            if (connData.peerIds.size === 0) {
                connsMap.delete(conn);
                // Logger.enable && this._info(`Release: conn = ${conn} is released`);
                if (connsMap.size === 0) {
                    channelRemoved = true;
                    this._channelsMap.delete(channel);
                    // Logger.enable && this._info(`Release: channel '${channel}' is released`);
                }
            }
            Logger.enable && this._info(`Release '${channel}': count = ${connData.peerIds.size}`);
            if (channelRemoved) {
                this._emitter && this.emit('channel-removed', channel);
            }
            return connsMap.size;
        }
    }

    private _release(channel: string, conn: T1, peerId: string, all: boolean): number {
        Logger.enable && this._info(`Release '${channel}' (${all}): peerId = ${peerId}`);
        const connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            Logger.enable && this._warn(`Release '${channel}': '${channel}' is unknown`);
            return 0;
        }
        else {
            return this._releaseConnData(channel, conn, connsMap, peerId, all);
        }
    }

    release(channel: string, conn: T1, peerId: string): number {
        return this._release(channel, conn, peerId, false);
    }

    releaseAll(channel: string, conn: T1, peerId: string): number {
        return this._release(channel, conn, peerId, true);
    }

    releasePeerId(conn: T1, peerId: string) {
        Logger.enable && this._info(`releasePeerId: peerId = ${peerId}`);

        // ForEach is supposed to support deletion during the iteration !
        this._channelsMap.forEach((connsMap, channel) => {
            this._releaseConnData(channel, conn, connsMap, peerId, true);
        });
    }

    releaseConnection(conn: T1) {
        Logger.enable && this._info(`ReleaseConn: conn = ${conn}`);

        // ForEach is supposed to support deletion during the iteration !
        this._requestChannels.forEach((connCurrent, channel) => {
            if (connCurrent === conn) {
                this._requestChannels.delete(channel);
            }
        });

        // ForEach is supposed to support deletion during the iteration !
        this._channelsMap.forEach((connsMap, channel) => {
            this._releaseConnData(channel, conn, connsMap, null, false);
        });
    }

    // forEachConnection(callback: ChannelConnectionMap.ForEachHandler<T1>) {
    //     const connections = new Map<T1, ChannelConnectionMap.ConnectionData<T1>>();
    //     this._channelsMap.forEach((connsMap, channel) => {
    //         connsMap.forEach((connData, connKey) => {
    //             connections.set(connData.conn, connData);
    //         });
    //     });
    //     connections.forEach((connData, connKey) => {
    //         callback(connData, '');
    //     });
    // }

    forEachChannel(channel: string, callback: ConnectionData.ForEachHandler<T1>) {
        Logger.enable && this._info(`forEachChannel '${channel}'`);

        // if ((callback instanceof Function) === false) {
        //     Logger.enable && this._error('forEachChannel: No callback provided !');
        //     return;
        // }

        const connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            Logger.enable && this._warn(`forEachChannel: Unknown channel '${channel}' !`);
        }
        else {
            connsMap.forEach((connData, conn) => {
                Logger.enable && this._info(`forEachChannel '${channel}' - ${JSON.stringify(Array.from(connData.peerIds.keys()))} (${connData.peerIds.size})`);
                callback(connData, channel);
            });
        }
    }

    forEach(callback: ConnectionData.ForEachHandler<T1>) {
        Logger.enable && this._info('forEach');

        // if ((callback instanceof Function) === false) {
        //     Logger.enable && this._error('forEach: No callback provided !');
        //     return;
        // }

        this._channelsMap.forEach((connsMap, channel: string) => {
            connsMap.forEach((connData, conn) => {
                Logger.enable && this._info(`forEach '${channel}' - ${JSON.stringify(Array.from(connData.peerIds.keys()))} (${connData.peerIds.size})`);
                callback(connData, channel);
            });
        });
    }

    on(event: 'channel-added', listener: (channel: string) => void): this;
    on(event: 'channel-removed', listener: (channel: string) => void): this;
    on(event: symbol | string, listener: (...args: any[]) => void): this {
        return super.addListener(event, listener);
    }

    off(event: 'channel-added', listener: (channel: string) => void): this;
    off(event: 'channel-removed', listener: (channel: string) => void): this;
    off(event: symbol | string, listener: (...args: any[]) => void): this {
        return super.removeListener(event, listener);
    }
}

/** @internal */
export class ConnectionData<T1> {
    readonly conn: T1;
    peerIds: Map<string, ConnectionData.PeerIdRefCount> = new Map<string, ConnectionData.PeerIdRefCount>();

    constructor(conn: T1, peerId: string) {
        this.conn = conn;
        const peerIdRefCount = { peerId, refCount: 1 };
        this.peerIds.set(peerId, peerIdRefCount);
    }

    addPeerId(peerId: string): number {
        let peerIdRefCount = this.peerIds.get(peerId);
        if (peerIdRefCount == null) {
            // This channel has NOT been already subcribed by this peername, by default 1
            peerIdRefCount = { peerId, refCount: 1 };
            this.peerIds.set(peerId, peerIdRefCount);
        }
        else {
            ++peerIdRefCount.refCount;
        }
        return peerIdRefCount.refCount;
    }

    clearPeerIds() {
        this.peerIds.clear();
    }

    removePeerId(peerId: string): boolean {
        return this.peerIds.delete(peerId);
    }

    releasePeerId(peerId: string) {
        const peerIdRefCount = this.peerIds.get(peerId);
        if (peerIdRefCount == null) {
            return null;
            // Logger.enable && this._warn(`Release '${channel}': peerId #${peerId} is unknown`);
        }
        else {
            // This connection has subscribed to this channel
            if (--peerIdRefCount.refCount <= 0) {
                // The connection is no more referenced
                this.peerIds.delete(peerId);
                // Logger.enable && this._info(`Release: peerId #${peerId} is released`);
            }
        }
        return peerIdRefCount.refCount;
    }
}

/** @internal */
export namespace ConnectionData {
    /** @internal */
    export interface PeerIdRefCount {
        peerId: string;
        refCount: number;
    }

    /** @internal */
    export interface ForEachHandler<T1> {
        (ConnectionData: ConnectionData<T1>, channel: string): void;
    };
};

