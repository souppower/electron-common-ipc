// Constants
import { EventEmitter } from 'events';

import { IpcNetOptions } from './IpcBusClient';

export const IPC_BUS_TIMEOUT = 2000;

const win32prefix1 = '\\\\.\\pipe';
const win32prefix2 = '\\\\?\\pipe';

// https://nodejs.org/api/net.html#net_ipc_support
function CleanPipeName(str: string) {
    if (process.platform === 'win32') {
        str = str.replace(/^\//, '');
        str = str.replace(/\//g, '-');
        if ((str.lastIndexOf(win32prefix1, 0) === -1) || (str.lastIndexOf(win32prefix2, 0) === -1)) {
            str = win32prefix1 + '\\' + str;
        }
    }
    return str;
}

export function CheckCreateOptions(options: IpcNetOptions | string | number, hostName?: string): IpcNetOptions | null {
    // A port number : 59233, 42153
    // A port number + hostname : 59233, '127.0.0.1'
    if (Number(options) >= 0) {
        return { port: Number(options), host: hostName };
    }
    // A 'hostname:port' pattern : 'localhost:8082'
    // A path : '//local-ipc'
    else if (typeof options === 'string') {
        let parts = options.split(':');
        if (parts.length === 2) {
            if (Number(parts[1]) >= 0) {
                return { port: Number(parts[1]), host: parts[0] };
            }
        }
        return { path: CleanPipeName(options) };
    }
    // An IpcNetOptions object similar to NodeJS.net.ListenOptions
    else if (typeof options === 'object') {
        let localOptions: IpcNetOptions = options as Object || {};
        if (localOptions.port) {
            return localOptions;
        }
        if (localOptions.path) {
            localOptions.path =  CleanPipeName(localOptions.path);
            return localOptions;
        }
    }
    return null;
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
    let keys = Object.keys(data);
    for (let i = 0, l = keys.length; i < l; ++i) {
        if (output.length >= maxLen) {
            output += '\'__cut__\'';
            break;
        }
        let key = keys[i];
        output += key + ': ';
        if (output.length >= maxLen) {
            output += '\'__cut__\'';
            break;
        }
        output += JSON_stringify(data[key], maxLen - output.length);
        output += ',';
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
export class ChannelConnectionMap<T1 extends string | number, T2> extends EventEmitter {
    private _name: string;
    private _channelsMap: Map<string, Map<T1, ChannelConnectionMap.ConnectionData<T1, T2>>>;

    constructor(name: string) {
        super();
        this._name = name;
        this._channelsMap = new Map<string, Map<T1, ChannelConnectionMap.ConnectionData<T1, T2>>>();
    }

    private _info(str: string) {
        Logger.enable && Logger.info(`[${this._name}] ${str}`);
    }

    private _warn(str: string) {
        Logger.enable && Logger.warn(`[${this._name}] ${str}`);
    }

    private _error(str: string) {
        Logger.enable && Logger.error(`[${this._name}] ${str}`);
    }

    hasChannel(channel: string): boolean {
        return this._channelsMap.has(channel);
    }

    clear() {
        this._channelsMap.clear();
    }

    addRef(channel: string, connKey: T1, conn: any, peerId: string): number {
        let channelAdded = false;
        Logger.enable && this._info(`AddRef: '${channel}', connKey = ${connKey}`);

        let connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            channelAdded = true;
            connsMap = new Map<T1, ChannelConnectionMap.ConnectionData<T1, T2>>();
            // This channel has NOT been subscribed yet, add it to the map
            this._channelsMap.set(channel, connsMap);
            // Logger.enable && this._info(`AddRef: channel '${channel}' is added`);
        }
        let connData = connsMap.get(connKey);
        if (connData == null) {
            // This channel has NOT been already subscribed by this connection
            connData = new ChannelConnectionMap.ConnectionData<T1, T2>(connKey, conn);
            connsMap.set(connKey, connData);
            // Logger.enable && this._info(`AddRef: connKey = ${connKey} is added`);
        }
        connData.addPeerId(peerId);
        Logger.enable && this._info(`AddRef: '${channel}', connKey = ${connKey}, count = ${connData.peerIds.size}`);
        if (channelAdded) {
            this.emit('channel-added', channel);
        }
        return connsMap.size;
    }

    private _releaseConnData(channel: string, connKey: T1, connsMap: Map<T1, ChannelConnectionMap.ConnectionData<T1, T2>>, peerId: string, all: boolean): number {
        let channelRemoved = false;
        let connData = connsMap.get(connKey);
        if (connData == null) {
            Logger.enable && this._warn(`Release '${channel}': connKey = ${connKey} is unknown`);
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
                connsMap.delete(connKey);
                // Logger.enable && this._info(`Release: conn = ${connKey} is released`);
                if (connsMap.size === 0) {
                    channelRemoved = true;
                    this._channelsMap.delete(channel);
                    // Logger.enable && this._info(`Release: channel '${channel}' is released`);
                }
            }
            Logger.enable && this._info(`Release '${channel}': connKey = ${connKey}, count = ${connData.peerIds.size}`);
            if (channelRemoved) {
                this.emit('channel-removed', channel);
            }
            return connsMap.size;
        }
    }

    private _release(channel: string, connKey: T1, peerId: string, all: boolean): number {
        Logger.enable && this._info(`_release (${all}): channel=${channel}, connKey = ${connKey}`);
        let connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            Logger.enable && this._warn(`Release '${channel}': '${channel}' is unknown`);
            return 0;
        }
        else {
            return this._releaseConnData(channel, connKey, connsMap, peerId, all);
        }
    }

    release(channel: string, connKey: T1, peerId: string): number {
        return this._release(channel, connKey, peerId, false);
    }

    releaseAll(channel: string, connKey: T1, peerId: string): number {
        return this._release(channel, connKey, peerId, true);
    }

    releasePeerId(connKey: T1, peerId: string) {
        Logger.enable && this._info(`releasePeerId: connKey = ${connKey}, peerId = ${peerId}`);

        // ForEach is supposed to support deletion during the iteration !
        this._channelsMap.forEach((connsMap, channel) => {
            this._releaseConnData(channel, connKey, connsMap, peerId, true);
        });
    }

    releaseConnection(connKey: T1) {
        Logger.enable && this._info(`ReleaseConn: connKey = ${connKey}`);

        // ForEach is supposed to support deletion during the iteration !
        this._channelsMap.forEach((connsMap, channel) => {
            this._releaseConnData(channel, connKey, connsMap, null, false);
        });
    }

    forEachConnection(callback: ChannelConnectionMap.ForEachHandler<T1, T2>) {
        let connections = new Map<T1, ChannelConnectionMap.ConnectionData<T1, T2>>();
        this._channelsMap.forEach((connsMap, channel) => {
            connsMap.forEach((connData, connKey) => {
                connections.set(connData.connKey, connData);
            });
        });
        connections.forEach((connData, connKey) => {
            callback(connData, '');
        });
    }

    forEachChannel(channel: string, callback: ChannelConnectionMap.ForEachHandler<T1, T2>) {
        Logger.enable && this._info(`forEachChannel: '${channel}'`);

        if ((callback instanceof Function) === false) {
            Logger.enable && this._error('forEachChannel: No callback provided !');
            return;
        }

        let connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            Logger.enable && this._warn(`forEachChannel: Unknown channel '${channel}' !`);
        }
        else {
            connsMap.forEach((connData, connKey) => {
                Logger.enable && this._info(`forEachChannel: '${channel}', connKey = ${connKey} (${connData.peerIds.size})`);
                callback(connData, channel);
            });
        }
    }

    forEach(callback: ChannelConnectionMap.ForEachHandler<T1, T2>) {
        Logger.enable && this._info('forEach');

        if ((callback instanceof Function) === false) {
            Logger.enable && this._error('forEach: No callback provided !');
            return;
        }

        this._channelsMap.forEach((connsMap, channel: string) => {
            connsMap.forEach((connData, connKey) => {
                Logger.enable && this._info(`forEach: '${channel}', connKey = ${connKey} (${connData.peerIds.size})`);
                callback(connData, channel);
            });
        });
    }
}

/** @internal */
export interface PeerIdRefCount {
    peerId: string;
    refCount: number;
}

/** @internal */
export namespace ChannelConnectionMap {
    /** @internal */
    export class ConnectionData<T1 extends string | number, T2> {
        readonly connKey: T1;
        readonly conn: T2;
        peerIds: Map<string, PeerIdRefCount> = new Map<string, PeerIdRefCount>();

        constructor(connKey: T1, conn: T2) {
            this.connKey = connKey;
            this.conn = conn;
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
            let peerIdRefCount = this.peerIds.get(peerId);
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

    // /** @internal */
    // export interface MapHandler<T1 extends string | number> {
    //     (channel: string, peerId: string, connData: ConnectionData<T1, T2>): void;
    // };

    /** @internal */
    export interface ForEachHandler<T1 extends string | number, T2> {
        (ConnectionData: ConnectionData<T1, T2>, channel: string): void;
    };
};

