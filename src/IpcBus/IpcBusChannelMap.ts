import type { IpcBusPeer } from './IpcBusClient';
import { Logger, partialCall } from './IpcBusUtils';

// Structure
// Channel has key
// then list of "transports" for this channel: key + implem (socket or webContents)
// then list of ref counted peerIds for this transport

/** @internal */
export interface ChannelConnectionRef<T, K extends string | number> {
    readonly key: K;
    readonly conn: T;
}

/** @internal */
export class ChannelConnectionPeers<T, K extends string | number> {
    readonly ref: ChannelConnectionRef<T, K>;
    readonly peerRefCounts: Map<string, ChannelConnectionPeers.PeerRefCount> = new Map<string, ChannelConnectionPeers.PeerRefCount>();

    constructor(conn: ChannelConnectionRef<T, K>, peer: IpcBusPeer, count: number) {
        this.ref = conn;
        const refCount = (count == null) ? 1 : count;
        const peerRefCount = { peer, refCount };
        this.peerRefCounts.set(peer.id, peerRefCount);
    }

    addPeer(peer: IpcBusPeer, count: number): number {
        const refCount = (count == null) ? 1 : count;
        let peerRefCount = this.peerRefCounts.get(peer.id);
        if (peerRefCount == null) {
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
            return peerRefCount.refCount;
        }
    }
}

/** @internal */
export interface ChannelConnectionMapClient<T, K extends string | number> {
    channelAdded(channel: string, conn: ChannelConnectionRef<T, K>): void;
    channelRemoved(channel: string, conn: ChannelConnectionRef<T, K>): void;
}

/** @internal */
export class ChannelConnectionMap<T, K extends string | number> {
    private _name: string;
    private _channelsMap: Map<string, Map<K, ChannelConnectionPeers<T, K>>>;

    public client: ChannelConnectionMapClient<T, K>;

    constructor(name: string, client?: ChannelConnectionMapClient<T, K>) {
        this._name = name;
        this.client = client;
        this._channelsMap = new Map<string, Map<K, ChannelConnectionPeers<T, K>>>();
    }

    private _info(str: string) {
        Logger.enable && Logger.info(`[${this._name}] ${str}`);
    }

    private _warn(str: string) {
        Logger.enable && Logger.warn(`[${this._name}] ${str}`);
    }

    hasChannel(channel: string): boolean {
        return this._channelsMap.has(channel);
    }

    getChannels(): string[] {
        const channels = Array.from(this._channelsMap.keys());
        return channels;
    }

    getChannelsCount(): number {
        return this._channelsMap.size;
    }

    clear() {
        this._channelsMap.clear();
    }

    addRefs(channels: string[], conn: ChannelConnectionRef<T, K>, peer: IpcBusPeer): void {
        for (let i = 0, l = channels.length; i < l; ++i) {
            this.addRef(channels[i], conn, peer);
        }
    }

    releases(channels: string[], key: K, peer: IpcBusPeer): void {
        for (let i = 0, l = channels.length; i < l; ++i) {
            this.release(channels[i], key, peer);
        }
    }

    protected _addChannel(client: ChannelConnectionMapClient<T, K>, channel: string, conn: ChannelConnectionRef<T, K>, peer: IpcBusPeer, count: number): Map<K, ChannelConnectionPeers<T, K>> {
        Logger.enable && this._info(`SetChannel: '${channel}', peerId =  ${peer ? peer.id : 'unknown'}`);

        const connsMap = new Map<K, ChannelConnectionPeers<T, K>>();
        // This channel has NOT been subscribed yet, add it to the map
        this._channelsMap.set(channel, connsMap);

        const connData = new ChannelConnectionPeers<T, K>(conn, peer, count);
        connsMap.set(conn.key, connData);

        if (client) client.channelAdded(channel, conn);

        return connsMap;
    }

    private _removeChannel(client: ChannelConnectionMapClient<T, K>, channel: string, conn: ChannelConnectionRef<T, K>): boolean {
        if (this._channelsMap.delete(channel)) {
            if (client) client.channelRemoved(channel, conn);
            return true;
        }
        return false;
    }

    // Channel is supposed to be new
    pushResponseChannel(channel: string, conn: ChannelConnectionRef<T, K>, peer: IpcBusPeer) {
        this._addChannel(null, channel, conn, peer, 1);
    }

    popResponseChannel(channel: string): ChannelConnectionRef<T, K> | null {
        const connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            return null;
        }
        if (connsMap.size !== 1) {
            throw 'should not happen';
        }
        const connData = connsMap.values().next().value;
        this._removeChannel(null, channel, connData.conn);
        return connData.conn;
    }

    addRefCount(channel: string, conn: ChannelConnectionRef<T, K>, peer: IpcBusPeer, count: number): number {
        Logger.enable && this._info(`AddRef: '${channel}': conn = ${conn.key}, peerId =  ${peer ? peer.id : 'unknown'}`);

        let connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            connsMap = this._addChannel(this.client, channel, conn, peer, count);
        }
        else {
            let connData = connsMap.get(conn.key);
            if (connData == null) {
                // This channel has NOT been already subscribed by this connection
                connData = new ChannelConnectionPeers<T, K>(conn, peer, count);
                connsMap.set(conn.key, connData);
                // Logger.enable && this._info(`AddRef: connKey = ${conn} is added`);
            }
            else {
                connData.addPeer(peer, count);
            }
        }
        return connsMap.size;
    }

    addRef(channel: string, conn: ChannelConnectionRef<T, K>, peer: IpcBusPeer): number {
        return this.addRefCount(channel, conn, peer, 1);
    }

    private _releaseConnData(channel: string, connData: ChannelConnectionPeers<T, K>, connsMap: Map<K, ChannelConnectionPeers<T, K>>, peer: IpcBusPeer, all: boolean): number {
        if (peer == null) {
            connData.clearPeers();
        }
        else {
            if (all) {
                if (connData.removePeer(peer) === false) {
                    Logger.enable && this._warn(`Release '${channel}': peerId # ${peer ? peer.id : 'unknown'} is unknown`);
                }
            }
            else {
                connData.releasePeer(peer);
            }
        }
        if (connData.peerRefCounts.size === 0) {
            connsMap.delete(connData.ref.key);
            // Logger.enable && this._info(`Release: conn = ${conn} is released`);
            if (connsMap.size === 0) {
                this._removeChannel(this.client, channel, connData.ref);
            }
        }
        Logger.enable && this._info(`Release '${channel}': count = ${connData.peerRefCounts.size}`);
        return connsMap.size;
    }

    private _releaseChannel(channel: string, key: K, peer: IpcBusPeer, all: boolean): number {
        Logger.enable && this._info(`Release '${channel}' (${all}): peerId = ${peer ? peer.id : 'unknown'}`);
        const connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            Logger.enable && this._warn(`Release '${channel}': '${channel}' is unknown`);
            return 0;
        }
        else {
            const connData = connsMap.get(key);
            if (connData == null) {
                Logger.enable && this._warn(`Release '${channel}': conn is unknown`);
                return 0;
            }
            return this._releaseConnData(channel, connData, connsMap, peer, all);
        }
    }

    release(channel: string, key: K, peer: IpcBusPeer): number {
        return this._releaseChannel(channel, key, peer, false);
    }

    releaseAll(channel: string, key: K, peer: IpcBusPeer): number {
        return this._releaseChannel(channel, key, peer, true);
    }

    removePeer(peer: IpcBusPeer) {
        Logger.enable && this._info(`removePeer: peer = ${peer}`);
        // We can not use _getKey as it may access a property which is no more accessible when the 'conn' is destroyed
        this._channelsMap.forEach((connsMap, channel) => {
            connsMap.forEach((connData) => {
                this._releaseConnData(channel, connData, connsMap, peer, true);
            });
        });
    }

    removeConnection(conn: T) {
        // We can not use _getKey as it may access a property which is no more accessible when the 'conn' is destroyed
        this._channelsMap.forEach((connsMap, channel) => {
            connsMap.forEach((connData) => {
                if (connData.ref.conn === conn) {
                    this._releaseConnData(channel, connData, connsMap, null, true);
                }
            });
        });
    }

    removeKey(key: K) {
        Logger.enable && this._info(`removeKey: key = ${key}`);
        this._channelsMap.forEach((connsMap, channel) => {
            const connData = connsMap.get(key);
            if (connData) {
                this._releaseConnData(channel, connData, connsMap, null, true);
            }
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

    // getChannelConns(channel: string): Map<K, ConnectionPeers<T, K>> {
    //     return this._channelsMap.get(channel);
    // }

    getPeers(): IpcBusPeer[] {
        const peers: any = {};
        this._channelsMap.forEach((connsMap) => {
            connsMap.forEach((connData) => {
                connData.peerRefCounts.forEach((peerRefCount) => {
                    peers[peerRefCount.peer.id] = peerRefCount.peer;
                });
            });
        });
        return Object.values(peers);
    }

    getConns(): ChannelConnectionRef<T, K>[] {
        // @ts-ignore really an edge case for the compiler that has not been implemented
        const conns: { [key: K]: T } = {};
        this._channelsMap.forEach((connsMap) => {
            connsMap.forEach((connData) => {
                // @ts-ignore really an edge case for the compiler that has not been implemented
                conns[connData.key] = connData.ref;
            });
        });
        return Object.values(conns);
    }

    forEachChannel(channel: string, callback: ChannelConnectionPeers.ForEachChannelHandler<T, K>) {
        Logger.enable && this._info(`forEachChannel '${channel}'`);
        const connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            Logger.enable && this._warn(`forEachChannel: Unknown channel '${channel}' !`);
        }
        else {
            connsMap.forEach((connData) => callback(connData.ref));
        }
    }

    forEach(callback: ChannelConnectionPeers.ForEachHandler<T, K>) {
        Logger.enable && this._info('forEach');
        this._channelsMap.forEach((connsMap, channel) => {
            const cb = partialCall(callback, channel);
            connsMap.forEach((connData) => cb(connData.ref));
        });
    }
}

/** @internal */
export namespace ChannelConnectionPeers {
    /** @internal */
    export interface PeerRefCount {
        peer: IpcBusPeer;
        refCount: number;
    }

    /** @internal */
    export interface ForEachChannelHandler<T, K extends string | number> {
        (value: ChannelConnectionRef<T, K>): void;
    };

    /** @internal */
    export interface ForEachHandler<T, K extends string | number> {
        (channel: string, value: ChannelConnectionRef<T, K>): void;
    };
};

