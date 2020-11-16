import * as net from 'net';

import { IpcPacketBuffer } from 'socket-serializer';

import * as Client from '../IpcBusClient';
import * as Broker from './IpcBusBroker';
import * as IpcBusUtils from '../IpcBusUtils';
// import { Create as CreateIpcBusClientNet } from './IpcBusClientNet-factory';

import { IpcBusCommand } from '../IpcBusCommand';

import {IpcBusBrokerSocketClient, IpcBusBrokerSocket } from './IpcBusBrokerSocket';

/** @internal */
export class IpcBusBrokerImpl implements Broker.IpcBusBroker, IpcBusBrokerSocketClient {
    // protected _ipcBusBrokerClient: Client.IpcBusClient;
    private _socketClients: Map<net.Socket, IpcBusBrokerSocket>;
    private _socketIdValue: number;
    private _socketIdProperty: any;

    private _server: net.Server;
    private _netBinds: { [key: string]: (...args: any[]) => void };

    private _promiseStarted: Promise<void>;

    protected _subscriptions: IpcBusUtils.ChannelConnectionMap<net.Socket, number>;

    constructor(contextType: Client.IpcBusProcessType) {
        // Callbacks
        this._netBinds = {};
        this._netBinds['error'] = this._onServerError.bind(this);
        this._netBinds['close'] = this._onServerClose.bind(this);
        this._netBinds['connection'] = this._onServerConnection.bind(this);

        // this._onQueryState = this._onQueryState.bind(this);
        this._socketClients = new Map<net.Socket, IpcBusBrokerSocket>();
        this._socketIdValue = 0;
        this._socketIdProperty = Symbol("__ecipc__");

        // this._bridgeChannels = new Set<string>();

        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<net.Socket, number>(
            'IPCBus:Broker',
            (conn) => (conn as any)[this._socketIdProperty],
            false);
        // this._ipcBusBrokerClient = CreateIpcBusClientNet(contextType);
    }

    // protected _onQueryState(ipcBusEvent: Client.IpcBusEvent, replyChannel: string) {
    //     const queryState = this.queryState();
    //     if (ipcBusEvent.request) {
    //         ipcBusEvent.request.resolve(queryState);
    //     }
    //     else if (replyChannel != null) {
    //         this._ipcBusBrokerClient.send(replyChannel, queryState);
    //     }
    // }

    protected _reset(closeServer: boolean) {
        if (this._server) {
            const server = this._server;
            this._server = null;
            for (let key in this._netBinds) {
                server.removeListener(key, this._netBinds[key]);
            }

            // this._ipcBusBrokerClient.removeListener(Client.IPCBUS_CHANNEL_QUERY_STATE, this._onQueryState);
            // this._ipcBusBrokerClient.close();

            for (let [, socket] of this._socketClients) {
                socket.release(closeServer);
            }

            server.close();
            server.unref();
        }
        this._promiseStarted = null;
        this._socketClients.clear();
        this._subscriptions.clear();
    }

    // IpcBusBroker API
    connect(arg1: Broker.IpcBusBroker.ConnectOptions | string | number, arg2?: Broker.IpcBusBroker.ConnectOptions | string, arg3?: Broker.IpcBusBroker.ConnectOptions): Promise<void> {
        const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
        if ((options.port == null) && (options.path == null)) {
            return Promise.reject('Connection options not provided');
        }
        // Store in a local variable, in case it is set to null (paranoid code as it is asynchronous!)
        let p = this._promiseStarted;
        if (!p) {
            p = this._promiseStarted = new Promise<void>((resolve, reject) => {
                const server = net.createServer();
                server.unref();

                let timer: NodeJS.Timer = null;
                let fctReject: (msg: string) => void;

                const removeLocalListeners = () => {
                    if (timer) {
                        clearTimeout(timer);
                        timer = null;
                    }
                    server.removeListener('listening', catchListening);
                    server.removeListener('error', catchError);
                    server.removeListener('close', catchClose);
                };

                // Below zero = infinite
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        timer = null;
                        const msg = `[IPCBus:Broker] error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(options)}`;
                        fctReject(msg);
                    }, options.timeoutDelay);
                }

                const catchError = (err: any) => {
                    const msg = `[IPCBus:Broker] error = ${err} on ${JSON.stringify(options)}`;
                    fctReject(msg);
                };

                const catchClose = () => {
                    const msg = `[IPCBus:Broker] close on ${JSON.stringify(options)}`;
                    fctReject(msg);
                };

                const catchListening = (_server: any) => {
                    removeLocalListeners();
                    this._server = server;
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Listening for incoming connections on ${JSON.stringify(options)}`);
                    for (let key in this._netBinds) {
                        this._server.addListener(key, this._netBinds[key]);
                    }
                    resolve();

                    // this._ipcBusBrokerClient.connect(options)
                    //     .then(() => {
                    //         this._ipcBusBrokerClient.addListener(Client.IPCBUS_CHANNEL_QUERY_STATE, this._onQueryState);
                    //         resolve();
                    //     })
                    //     .catch((err) => {
                    //         this._reset(true);
                    //         const msg = `[IPCBus:Broker] error = ${err}`;
                    //         IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                    //         reject(msg);
                    //     });
                };

                fctReject = (msg: string) => {
                    removeLocalListeners();
                    this._reset(false);
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                    reject(msg);
                };
                server.addListener('listening', catchListening);
                server.addListener('error', catchError);
                server.addListener('close', catchClose);
                if (options.path) {
                    server.listen(options.path);
                }
                else if (options.port && options.host) {
                    server.listen(options.port, options.host);
                }
                else {
                    server.listen(options.port);
                }
            });
        }
        return p;
    }

    close(options?: Broker.IpcBusBroker.CloseOptions): Promise<void> {
        options = options || {};
        if (options.timeoutDelay == null) {
            options.timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        return new Promise<void>((resolve, reject) => {
            if (this._server) {
                const server = this._server;
                let timer: NodeJS.Timer;
                const catchClose = () => {
                    clearTimeout(timer);
                    server.removeListener('close', catchClose);
                    resolve();
                };

                // Below zero = infinite
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        server.removeListener('close', catchClose);
                        const msg = `[IPCBus:Broker] stop, error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(options)}`;
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                        reject(msg);
                    }, options.timeoutDelay);
                }
                server.addListener('close', catchClose);
                this._reset(true);
            }
            else {
                resolve();
            }
        });
    }

    protected _socketCleanUp(socket: any): void {
        this._subscriptions.removeConnection(socket);
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Connection closed !`);
    }

    protected _onSocketConnected(socket: net.Socket): void {
        (socket as any)[this._socketIdProperty] = ++this._socketIdValue;
        this._socketClients.set(socket, new IpcBusBrokerSocket(socket, this));
    }

    onSocketError(socket: net.Socket, err: string): void {
        // Not closing server
        if (this._server) {
            this._socketClients.delete(socket);
            this._socketCleanUp(socket);
        }
    }

    onSocketClose(socket: net.Socket): void {
        // Not closing server
        if (this._server) {
            this._socketClients.delete(socket);
            this._socketCleanUp(socket);
        }
    }

    onSocketEnd(socket: net.Socket): void {
        this.onSocketClose(socket);
    }

    protected _onServerClose(): void {
        const msg = `[IPCBus:Broker] server close`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(msg);
        this._reset(false);
    }

    protected _onServerError(err: any) {
        const msg = `[IPCBus:Broker] server error ${err}`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
        this._reset(true);
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
        const ipcBusCommand: IpcBusCommand = packet.parseArrayAt(0);
        switch (ipcBusCommand.kind) {
            // case IpcBusCommand.Kind.Handshake:
            // case IpcBusCommand.Kind.Shutdown:
            //     break;

            case IpcBusCommand.Kind.Connect:
                break;

            case IpcBusCommand.Kind.Close:
                this._socketCleanUp(socket);
                break;

            case IpcBusCommand.Kind.AddChannelListener:
                this._subscriptions.addRef(ipcBusCommand.channel, socket, ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveChannelListener:
                this._subscriptions.release(ipcBusCommand.channel, socket, ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                this._subscriptions.releaseAll(ipcBusCommand.channel, socket, ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveListeners:
                this._subscriptions.removePeer(socket, ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.SendMessage:
                // Register the replyChannel
                if (ipcBusCommand.request) {
                    this._subscriptions.pushResponseChannel(ipcBusCommand.request.replyChannel, socket, ipcBusCommand.peer);
                }
                // Prevent echo message
                const sourceKey = this._subscriptions.getKey(socket);
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData) => {
                    if (connData.key !== sourceKey) {
                        connData.conn.write(packet.buffer);
                    }
                });
                this.bridgeBroadcastMessage(socket, ipcBusCommand, packet);
                break;

            case IpcBusCommand.Kind.RequestResponse: {
                const connData = this._subscriptions.popResponseChannel(ipcBusCommand.request.replyChannel);
                if (connData) {
                    connData.conn.write(packet.buffer);
                }
                else {
                    this.bridgeBroadcastMessage(socket, ipcBusCommand, packet);
                }
                break;
            }

            case IpcBusCommand.Kind.RequestClose: {
                if (this._subscriptions.popResponseChannel(ipcBusCommand.request.replyChannel)) {
                    // log IpcBusLog.Kind.GET_CLOSE_REQUEST
                }
                this.bridgeBroadcastMessage(socket, ipcBusCommand, packet);
                break;
            }

            case IpcBusCommand.Kind.LogGetMessage:
            case IpcBusCommand.Kind.LogLocalSendRequest:
            case IpcBusCommand.Kind.LogLocalRequestResponse: {
                this.bridgeBroadcastMessage(socket, ipcBusCommand, packet);
                break;
            }

            // BridgeClose/Connect received are coming from IpcBusBridge only !
            case IpcBusCommand.Kind.BridgeConnect: {
                this.bridgeConnect(socket);
                break;
            }

            case IpcBusCommand.Kind.BridgeClose: {
                this.bridgeClose();
                break;
            }

            default:
                console.log(JSON.stringify(ipcBusCommand, null, 4));
                throw 'IpcBusBrokerImpl: Not valid packet !';
        }
    }

    queryState(): Object {
        const queryStateResult: Object[] = [];
        this._subscriptions.forEach((connData, channel) => {
            connData.peerRefCounts.forEach((peerRefCount) => {
                queryStateResult.push({ channel: channel, peer: peerRefCount.peer, count: peerRefCount.refCount });
            });
        });
        return queryStateResult;
    }
    
    protected bridgeConnect(socket: net.Socket) {
    }

    protected bridgeClose() {
    }

    protected bridgeAddChannel(channel: string) {
    }

    protected bridgeRemoveChannel(channel: string) {
    }

    protected bridgeBroadcastMessage(socket: net.Socket, ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
    }
}
