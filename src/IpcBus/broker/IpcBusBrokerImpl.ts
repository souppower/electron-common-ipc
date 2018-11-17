import * as net from 'net';

import { IpcPacketBuffer, BufferListReader } from 'socket-serializer';

import * as Client from '../IpcBusClient';
import * as Broker from './IpcBusBroker';
import * as IpcBusUtils from '../IpcBusUtils';
// import * as util from 'util';

import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusClientTransportNode } from '../IpcBusClientTransportNode';

interface IpcBusBrokerSocketClient {
    onSocketPacket(socket: net.Socket, ipcPacketBuffer: IpcPacketBuffer): void;
    onSocketError(socket: net.Socket, err: string): void;
    onSocketClose(socket: net.Socket): void;
};

class IpcBusBrokerSocket {
    private _socket: net.Socket;
    protected _socketBinds: { [key: string]: Function };

    private _packetIn: IpcPacketBuffer;
    private _bufferListReader: BufferListReader;
    private _client: IpcBusBrokerSocketClient;

    constructor(socket: net.Socket, client: IpcBusBrokerSocketClient) {
        this._socket = socket;
        this._client = client;

        this._bufferListReader = new BufferListReader();
        this._packetIn = new IpcPacketBuffer();

        this._socketBinds = {};
        this._socketBinds['error'] = this._onSocketError.bind(this);
        this._socketBinds['close'] = this._onSocketClose.bind(this);
        this._socketBinds['data'] = this._onSocketData.bind(this);

        for (let key in this._socketBinds) {
            this._socket.addListener(key, this._socketBinds[key]);
        }
    }

    release() {
        if (this._socket) {
            for (let key in this._socketBinds) {
                this._socket.removeListener(key, this._socketBinds[key]);
            }
            this._socket.end();
            this._socket.unref();
            // this._socket.destroy();
            this._socket = null;
        }
    }

    protected _onSocketData(buffer: Buffer) {
        this._bufferListReader.appendBuffer(buffer);
        while (this._packetIn.decodeFromReader(this._bufferListReader)) {
            this._client.onSocketPacket(this._socket, this._packetIn);
            // Remove read buffer
            this._bufferListReader.reduce();
        }
    }

    protected _onSocketError(err: any) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Error on connection: ${this._socket.remoteAddress} - ${err}`);
        this._client.onSocketError(this._socket, err);
    }

    protected _onSocketClose() {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Close on connection: ${this._socket.remoteAddress}`);
        this._client.onSocketClose(this._socket);
    }

    // protected _onSocketEnd() {
    //     IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Close on connection: ${socket.remoteAddress}`);
    //     this._client.onSocketClose(this._socket);
    // }
}


/** @internal */
export class IpcBusBrokerImpl implements Broker.IpcBusBroker, IpcBusBrokerSocketClient {
    private _netOptions: Client.IpcNetOptions;
    private _ipcBusBrokerClient: Client.IpcBusClient;
    private _socketClients: Map<number, IpcBusBrokerSocket>;

    private _server: net.Server;
    private _netBinds: { [key: string]: Function };

    private _promiseStarted: Promise<void>;

    private _subscriptions: IpcBusUtils.ChannelConnectionMap<number, net.Socket>;
    private _wildSubscriptions: Set<string>;
    private _requestChannels: Map<string, net.Socket>;
    private _ipcBusPeers: Map<string, Client.IpcBusPeer>;

    private _queryStateLamdba: Client.IpcBusListener = (ipcBusEvent: Client.IpcBusEvent, replyChannel: string) => this._onQueryState(ipcBusEvent, replyChannel);

    constructor(contextType: Client.IpcBusContextType, options: Broker.IpcBusBroker.CreateOptions) {
        this._netOptions = options;

        this._netBinds = {};
        this._netBinds['error'] = this._onServerError.bind(this);
        this._netBinds['close'] = this._onServerClose.bind(this);
        this._netBinds['connection'] = this._onServerConnection.bind(this);

        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<number, net.Socket>('IPCBus:Broker');
        this._wildSubscriptions = new Set<string>();
        this._requestChannels = new Map<string, net.Socket>();
        this._socketClients = new Map<number, IpcBusBrokerSocket>();
        this._ipcBusPeers = new Map<string, Client.IpcBusPeer>();

        this._subscriptions.on('channel-added', (channel: string) => {
            if (IpcBusUtils.ContainsWildCards(channel)) {
                // Remove '*' suffix
                this._wildSubscriptions.add(channel.slice(0, -1));
            }
        });

        this._subscriptions.on('channel-removed', (channel: string) => {
            if (IpcBusUtils.ContainsWildCards(channel)) {
                // Remove '*' suffix
                this._wildSubscriptions.delete(channel.slice(0, -1));
            }
        });

        this._ipcBusBrokerClient = new IpcBusClientTransportNode(contextType, { port: this._netOptions.port, host: this._netOptions.host, path: this._netOptions.path });
    }

    private _reset() {
        if (this._server) {
            let server = this._server;
            this._server = null;
            for (let key in this._netBinds) {
                server.removeListener(key, this._netBinds[key]);
            }

            this._socketClients.forEach((socket) => {
                socket.release();
            });
            this._ipcBusBrokerClient.off(Client.IPCBUS_CHANNEL_QUERY_STATE, this._queryStateLamdba);
            this._ipcBusBrokerClient.close();
            server.close();
            server.unref();
        }
        this._promiseStarted = null;
        this._requestChannels.clear();
        this._socketClients.clear();
        this._ipcBusPeers.clear();
        this._subscriptions.clear();
    }

    // IpcBusBroker API
    start(options?: Broker.IpcBusBroker.StartOptions): Promise<void> {
        options = options || {};
        if (options.timeoutDelay == null) {
            options.timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        // Store in a local variable, in case it is set to null (paranoid code as it is asynchronous!)
        let p = this._promiseStarted;
        if (!p) {
            p = this._promiseStarted = new Promise<void>((resolve, reject) => {
                let server = net.createServer();
                let timer: NodeJS.Timer = null;
                let fctReject: (msg: string) => void;

                // Below zero = infinite
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        timer = null;
                        let msg = `[IPCBus:Broker] error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(this._netOptions)}`;
                        fctReject(msg);
                    }, options.timeoutDelay);
                }

                let catchError = (err: any) => {
                    let msg = `[IPCBus:Broker] error = ${err} on ${JSON.stringify(this._netOptions)}`;
                    fctReject(msg);
                };

                let catchClose = () => {
                    let msg = `[IPCBus:Broker] close on ${JSON.stringify(this._netOptions)}`;
                    fctReject(msg);
                };

                let catchListening =  (_server: any) => {
                    clearTimeout(timer);
                    server.removeListener('listening', catchListening);
                    server.removeListener('error', catchError);
                    server.removeListener('close', catchClose);

                    this._server = server;

                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Listening for incoming connections on ${JSON.stringify(this._netOptions)}`);
                    for (let key in this._netBinds) {
                        this._server.addListener(key, this._netBinds[key]);
                    }

                    this._ipcBusBrokerClient.connect({ peerName: `IpcBusBrokerClient`, timeoutDelay: options.timeoutDelay })
                        .then(() => {
                            this._ipcBusBrokerClient.on(Client.IPCBUS_CHANNEL_QUERY_STATE, this._queryStateLamdba);
                            resolve();
                        })
                        .catch((err) => {
                            this._reset();
                            let msg = `[IPCBus:Broker] error = ${err}`;
                            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                            reject(msg);
                        });
                };

                fctReject = (msg: string) => {
                    if (timer) {
                        clearTimeout(timer);
                    }
                    server.removeListener('listening', catchListening);
                    server.removeListener('error', catchError);
                    server.removeListener('close', catchClose);
                    this._reset();
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                    reject(msg);
                };
                server.addListener('listening', catchListening);
                server.addListener('error', catchError);
                server.addListener('close', catchClose);
                if (this._netOptions.path) {
                    server.listen(this._netOptions.path);
                }
                else if (this._netOptions.port && this._netOptions.host) {
                    server.listen(this._netOptions.port, this._netOptions.host);
                }
                else  {
                    server.listen(this._netOptions.port);
                }
            });
        }
        return p;
    }

    stop(options?: Broker.IpcBusBroker.StopOptions): Promise<void> {
        options = options || {};
        if (options.timeoutDelay == null) {
            options.timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        return new Promise<void>((resolve, reject) => {
            if (this._server) {
                let server = this._server;
                let timer: NodeJS.Timer;
                let catchClose = () => {
                    clearTimeout(timer);
                    server.removeListener('close', catchClose);
                    resolve();
                };

                // Below zero = infinite
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        server.removeListener('close', catchClose);
                        let msg = `[IPCBus:Broker] stop, error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(this._netOptions)}`;
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                        reject(msg);
                    }, options.timeoutDelay);
                }
                server.addListener('close', catchClose);
                this._reset();
            }
            else {
                resolve();
            }
        });
    }

    protected _socketCleanUp(socket: any): void {
        this._subscriptions.releaseConnection(socket.remotePort);
        // ForEach is supposed to support deletion during the iteration !
        this._requestChannels.forEach((socketForRequest, channel) => {
            if (socketForRequest.remotePort === socket.remotePort) {
                this._requestChannels.delete(channel);
            }
        });
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Connection closed !`);
    }

    protected _onSocketConnected(socket: net.Socket): void {
        this._socketClients.set(socket.remotePort, new IpcBusBrokerSocket(socket, this));
    }

    onSocketError(socket: net.Socket, err: string): void {
        // Not closing _server
        if (this._server) {
            this._socketClients.delete(socket.remotePort);
            this._socketCleanUp(socket);
        }
    }

    onSocketClose(socket: net.Socket): void {
        // Not closing _server
        if (this._server) {
            this._socketClients.delete(socket.remotePort);
            this._socketCleanUp(socket);
        }
    }

    protected _onServerClose(): void {
        let msg = `[IPCBus:Broker] server close`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(msg);
        this._reset();
    }

    protected _onServerError(err: any) {
        let msg = `[IPCBus:Broker] server error ${err}`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
        this._reset();
    }

    protected _onServerConnection(socket: net.Socket, _server: net.Server): void {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Incoming connection !`);
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.address=' + JSON.stringify(socket.address()));
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.localAddress=' + socket.localAddress);
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.remoteAddress=' + socket.remoteAddress);
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.remotePort=' + socket.remotePort);
        this._onSocketConnected(socket);
    }

    // protected _onServerData(packet: IpcPacketBuffer, socket: net.Socket, server: net.Server): void {
    onSocketPacket(socket: net.Socket, packet: IpcPacketBuffer): void {
        let ipcBusCommand: IpcBusCommand = packet.parseArrayAt(0);
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.Connect:
                this._ipcBusPeers.set(ipcBusCommand.peer.id, ipcBusCommand.peer);
                break;

            // User by peers associated with a webContent.
            // There is only one socket for managing all this peers
            // We must not close this socket but just peer in it
            case IpcBusCommand.Kind.Disconnect:
                if (this._ipcBusPeers.delete(ipcBusCommand.peer.id)) {
                    this._subscriptions.releasePeerId(socket.remotePort, ipcBusCommand.peer.id);
                }
                break;

            case IpcBusCommand.Kind.Close:
                this._socketCleanUp(socket);
                break;

            case IpcBusCommand.Kind.AddChannelListener:
                this._subscriptions.addRef(ipcBusCommand.channel, socket.remotePort, socket, ipcBusCommand.peer.id);
                break;

            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                this._subscriptions.releaseAll(ipcBusCommand.channel, socket.remotePort, ipcBusCommand.peer.id);
                break;

            case IpcBusCommand.Kind.RemoveChannelListener:
                this._subscriptions.release(ipcBusCommand.channel, socket.remotePort, ipcBusCommand.peer.id);
                break;

            case IpcBusCommand.Kind.RemoveListeners:
                this._subscriptions.releasePeerId(socket.remotePort, ipcBusCommand.peer.id);
                break;

            case IpcBusCommand.Kind.SendMessage:
                // IpcBusUtils.Logger.enable && console.log(`[IPCBus:Broker] SendMessage ${ipcBusCommand.channel}`);
                // if (IpcBusUtils.Logger.enable) {
                //     if (!this._subscriptions.hasChannel(ipcBusCommand.channel)) {
                //         console.log(`[IPCBus:Broker] SendMessage NoChannel !! ${ipcBusCommand.channel}`);
                //     }
                // }
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
                    connData.conn.write(packet.buffer);
                });
                if (this._wildSubscriptions.size > 0) {
                    let args: any[] = null;
                    let bufferPacket = new IpcPacketBuffer();
                    this._wildSubscriptions.forEach((wildChannel) => {
                        if (ipcBusCommand.channel.lastIndexOf(wildChannel, 0) === 0) {
                            // Re-add '*' suffix
                            ipcBusCommand.emit = wildChannel + '*';
                            args = args || packet.parseArrayAt(1);
                            bufferPacket.serializeArray([ipcBusCommand, args]);
                            this._subscriptions.forEachChannel(ipcBusCommand.emit, (connData, channel) => {
                                connData.conn.write(bufferPacket.buffer);
                            });
                        }
                    });
                }
                break;

            case IpcBusCommand.Kind.RequestMessage:
                // Register the replyChannel
                this._requestChannels.set(ipcBusCommand.request.replyChannel, socket);

                // Request ipcBusCommand to subscribed connections
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
                    connData.conn.write(packet.buffer);
                });
                break;

            case IpcBusCommand.Kind.RequestResponse: {
                let replySocket = this._requestChannels.get(ipcBusCommand.request.replyChannel);
                if (replySocket) {
                    this._requestChannels.delete(ipcBusCommand.request.replyChannel);
                    replySocket.write(packet.buffer);
                }
                break;
            }

            case IpcBusCommand.Kind.RequestCancel:
                this._requestChannels.delete(ipcBusCommand.request.replyChannel);
                break;

            default:
                console.log(JSON.stringify(ipcBusCommand, null, 4));
                throw 'IpcBusBrokerImpl: Not valid packet !';
        }
    }

    queryState(): Object {
        let queryStateResult: Object[] = [];
        this._subscriptions.forEach((connData, channel) => {
            connData.peerIds.forEach((peerIdRefCount) => {
                queryStateResult.push({ channel: channel, peer: this._ipcBusPeers.get(peerIdRefCount.peerId), count: peerIdRefCount.refCount });
            });
        });
        return queryStateResult;
    }

    protected _onQueryState(ipcBusEvent: Client.IpcBusEvent, replyChannel: string) {
        const queryState = this.queryState();
        if (ipcBusEvent.request) {
            ipcBusEvent.request.resolve(queryState);
        }
        else if (replyChannel != null) {
            this._ipcBusBrokerClient.send(replyChannel, queryState);
        }
    }
}
