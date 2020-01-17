// Constants
import { EventEmitter } from 'events';

import { IpcConnectOptions, IpcBusPeer } from './IpcBusClient';

export const IPC_BUS_TIMEOUT = 2000;// 20000;

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
    const options: T = (typeof arg1 === 'object' ? arg1 : typeof arg2 === 'object' ? arg2 : typeof arg3 === 'object' ? arg3: {}) as T; 
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
            options.path = arg1;
        }
    }
    // An IpcNetOptions object similar to NodeJS.net.ListenOptions
    if (options.path) {
        options.path = CleanPipeName(options.path);
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

// Structure
// Channel has key
// then list of "transports" for this channel: key + implem (socket or webContents)
// then list of ref counted peerIds for this transport

/** @internal */
export class ChannelConnectionMap<T> extends EventEmitter {
    private _name: string;
    private _channelsMap: Map<string, Map<T, ConnectionPeers<T>>>;
    private _requestChannels: Map<string, ConnectionPeer<T>>;
    
    public emitter: boolean;

    constructor(name: string, emitter: boolean) {
        super();
        this._name = name;
        this.emitter = emitter;
        this._channelsMap = new Map<string, Map<T, ConnectionPeers<T>>>();
        this._requestChannels = new Map<string,  ConnectionPeer<T>>();
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

    setRequestChannel(channel: string, conn: T, peer: IpcBusPeer): void {
        this._requestChannels.set(channel, { conn, peer });
    }

    getRequestChannel(channel: string): ConnectionPeer<T> {
        return this._requestChannels.get(channel);
    }

    deleteRequestChannel(channel: string): boolean {
        return this._requestChannels.delete(channel);
    }

    hasChannel(channel: string): boolean {
        return this._channelsMap.has(channel);
    }

    getChannels(): string[] {
        const channels = Array.from(this._channelsMap.keys())
        if (this._requestChannels.size) {
            return channels.concat(Array.from(this._requestChannels.keys()));
        }
        return channels;
    }

    getChannelsCount(): number {
        return this._channelsMap.size + this._requestChannels.size;
    }

    clear() {
        this._channelsMap.clear();
        this._requestChannels.clear();
    }

    addRefs(channels: string[], conn: T, peer: IpcBusPeer): void {
        for (let i = 0, l = channels.length; i < l; ++i) {
            this.addRef(channels[i], conn, peer);
        }
    }

    releases(channels: string[], conn: T, peer: IpcBusPeer): void {
        for (let i = 0, l = channels.length; i < l; ++i) {
            this.release(channels[i], conn, peer);
        }
    }

    addRefCount(channel: string, conn: T, peer: IpcBusPeer, count: number): number {
        Logger.enable && this._info(`AddRef: '${channel}', peerId = ${peer.id}`);

        let connData: ConnectionPeers<T>;
        let connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            connsMap = new Map<T, ConnectionPeers<T>>();
            // This channel has NOT been subscribed yet, add it to the map
            this._channelsMap.set(channel, connsMap);

            // Code is duplicated here but it would save time.
            // This channel has NOT been already subscribed by this connection
            connData = new ConnectionPeers<T>(conn, peer, count);
            connsMap.set(conn, connData);
            
            this.emitter && this.emit('channel-added', channel);
            // Logger.enable && this._info(`AddRef: channel '${channel}' is added`);
        }
        else {
            connData = connsMap.get(conn);
            if (connData == null) {
                // This channel has NOT been already subscribed by this connection
                connData = new ConnectionPeers<T>(conn, peer, count);
                connsMap.set(conn, connData);
                // Logger.enable && this._info(`AddRef: connKey = ${conn} is added`);
            }
            else {
                connData.addPeer(peer, count);
            }
        }
        Logger.enable && this._info(`AddRef: '${channel}', count = ${connData.peerRefCounts.size}`);
        return connsMap.size;
    }

    addRef(channel: string, conn: T, peer: IpcBusPeer): number {
        return this.addRefCount(channel, conn, peer,  1);
    }

    private _releaseConnData(channel: string, conn: T, connsMap: Map<T, ConnectionPeers<T>>, peer: IpcBusPeer, all: boolean): number {
        const connData = connsMap.get(conn);
        if (connData == null) {
            Logger.enable && this._warn(`Release '${channel}': conn is unknown`);
            return 0;
        }
        else {
            if (peer == null) {
                connData.clearPeers();
            }
            else {
                if (all) {
                    if (connData.removePeer(peer) === false) {
                        Logger.enable && this._warn(`Release '${channel}': peerId #${peer.id} is unknown`);
                    }
                }
                else {
                    connData.releasePeer(peer);
                }
            }
            if (connData.peerRefCounts.size === 0) {
                connsMap.delete(conn);
                // Logger.enable && this._info(`Release: conn = ${conn} is released`);
                if (connsMap.size === 0) {
                    this._channelsMap.delete(channel);
                    this.emitter && this.emit('channel-removed', channel);
                    // Logger.enable && this._info(`Release: channel '${channel}' is released`);
                }
            }
            Logger.enable && this._info(`Release '${channel}': count = ${connData.peerRefCounts.size}`);
            return connsMap.size;
        }
    }

    private _release(channel: string, conn: T, peer: IpcBusPeer, all: boolean): number {
        Logger.enable && this._info(`Release '${channel}' (${all}): peerId = ${peer.id}`);
        if (conn == null) {
            if (this._channelsMap.delete(channel)) {
                this.emitter && this.emit('channel-removed', channel);
            }
            return 0;
        }
        const connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            Logger.enable && this._warn(`Release '${channel}': '${channel}' is unknown`);
            return 0;
        }
        else {
            return this._releaseConnData(channel, conn, connsMap, peer, all);
        }
    }

    release(channel: string, conn: T, peer: IpcBusPeer): number {
        return this._release(channel, conn, peer, false);
    }

    releaseAll(channel: string, conn: T, peer: IpcBusPeer): number {
        return this._release(channel, conn, peer, true);
    }

    removeChannel(channel: string) {
        this._release(channel, null, null, true);
    }

    removePeer(conn: T, peer: IpcBusPeer) {
        Logger.enable && this._info(`releasePeerId: peerId = ${peer.id}`);

        this._requestChannels.forEach((connData, channel) => {
            if (connData.peer === peer) {
                this._requestChannels.delete(channel);
            }
        });

        // ForEach is supposed to support deletion during the iteration !
        this._channelsMap.forEach((connsMap, channel) => {
            this._releaseConnData(channel, conn, connsMap, peer, true);
        });
    }

    removeConnection(conn: T) {
        Logger.enable && this._info(`ReleaseConn: conn = ${conn}`);

        // ForEach is supposed to support deletion during the iteration !
        this._requestChannels.forEach((connData, channel) => {
            if (connData.conn === conn) {
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

    forEachChannel(channel: string, callback: ConnectionPeers.ForEachHandler<T>) {
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
                Logger.enable && this._info(`forEachChannel '${channel}' - ${JSON.stringify(Array.from(connData.peerRefCounts.keys()))} (${connData.peerRefCounts.size})`);
                callback(connData, channel);
            });
        }
    }

    forEach(callback: ConnectionPeers.ForEachHandler<T>) {
        Logger.enable && this._info('forEach');

        // if ((callback instanceof Function) === false) {
        //     Logger.enable && this._error('forEach: No callback provided !');
        //     return;
        // }

        this._channelsMap.forEach((connsMap, channel: string) => {
            connsMap.forEach((connData, conn) => {
                Logger.enable && this._info(`forEach '${channel}' - ${JSON.stringify(Array.from(connData.peerRefCounts.keys()))} (${connData.peerRefCounts.size})`);
                callback(connData, channel);
            });
        });
    }

    // on(event: 'channel-added', listener: (channel: string) => void): this;
    // on(event: 'channel-removed', listener: (channel: string) => void): this;
    on(event: 'channel-added', listener: (channel: string) => void): this;
    on(event: 'channel-removed', listener: (channel: string) => void): this;
    on(event: symbol | string, listener: (...args: any[]) => void): this {
        return super.addListener(event, listener);
    }

    // off(event: 'channel-added', listener: (channel: string) => void): this;
    // off(event: 'channel-removed', listener: (channel: string) => void): this;
    off(event: 'channel-added', listener: (channel: string) => void): this;
    off(event: 'channel-removed', listener: (channel: string) => void): this;
    off(event: symbol | string, listener: (...args: any[]) => void): this {
        return super.removeListener(event, listener);
    }
}

/** @internal */
export interface ConnectionPeer<T> {
    conn: T;
    peer: IpcBusPeer;
}

/** @internal */
export class ConnectionPeers<T> {
    readonly conn: T;
    peerRefCounts: Map<string, ConnectionPeers.PeerRefCount> = new Map<string, ConnectionPeers.PeerRefCount>();

    constructor(conn: T, peer: IpcBusPeer, count?: number) {
        this.conn = conn;
        const refCount = (count == null) ? 1 : count;
        const peerRefCount = { peer, refCount };
        this.peerRefCounts.set(peer.id, peerRefCount);
    }

    addPeer(peer: IpcBusPeer, count?: number): number {
        const refCount = (count == null) ? 1 : count;
        let peerRefCount = this.peerRefCounts.get(peer.id);
        if (peerRefCount == null) {
            // This channel has NOT been already subcribed by this peername, by default 1
            peerRefCount = { peer, refCount };
            this.peerRefCounts.set(peer.id, peerRefCount);
        }
        else {
            peerRefCount.refCount += refCount;
        }
        return peerRefCount.refCount;
    }

    clearPeers() {
        this.peerRefCounts.clear();
    }

    removePeer(peer: IpcBusPeer): boolean {
        return this.peerRefCounts.delete(peer.id);
    }

    releasePeer(peer: IpcBusPeer) {
        const peerRefCount = this.peerRefCounts.get(peer.id);
        if (peerRefCount == null) {
            return 0;
            // Logger.enable && this._warn(`Release '${channel}': peerId #${peerId} is unknown`);
        }
        else {
            // This connection has subscribed to this channel
            if (--peerRefCount.refCount <= 0) {
                // The connection is no more referenced
                this.peerRefCounts.delete(peer.id);
                // Logger.enable && this._info(`Release: peerId #${peerId} is released`);
            }
        }
        return peerRefCount.refCount;
    }
}

/** @internal */
export namespace ConnectionPeers {
    /** @internal */
    export interface PeerRefCount {
        peer: IpcBusPeer;
        refCount: number;
    }

    /** @internal */
    export interface ForEachHandler<T1> {
        (ConnectionData: ConnectionPeers<T1>, channel: string): void;
    };
};

