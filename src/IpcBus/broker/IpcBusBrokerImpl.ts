import * as net from 'net';

import { IpcPacketBuffer, BufferListReader, SocketWriter } from 'socket-serializer';

import * as Client from '../IpcBusClient';
import * as Broker from './IpcBusBroker';
import * as IpcBusUtils from '../IpcBusUtils';
import { Create as CreateIpcBusClientNet } from '../IpcBusClientNet';

import { IpcBusCommand } from '../IpcBusCommand';

interface IpcBusBrokerSocketClient {
    onSocketPacket(socket: net.Socket, ipcPacketBuffer: IpcPacketBuffer): void;
    onSocketError(socket: net.Socket, err: string): void;
    onSocketClose(socket: net.Socket): void;
};

class IpcBusBrokerSocket {
    private _socket: net.Socket;
    protected _socketBinds: { [key: string]: (...args: any[]) => void };

    private _packetIn: IpcPacketBuffer;
    private _bufferListReader: BufferListReader;
    private _client: IpcBusBrokerSocketClient;

    constructor(socket: net.Socket, client: IpcBusBrokerSocketClient) {
        this._socket = socket;
        this._client = client;

        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Connect: ${this._socket.remotePort}`);

        this._bufferListReader = new BufferListReader();
        this._packetIn = new IpcPacketBuffer();

        this._socketBinds = {};
        this._socketBinds['error'] = this._onSocketError.bind(this);
        this._socketBinds['close'] = this._onSocketClose.bind(this);
        this._socketBinds['data'] = this._onSocketData.bind(this);
        this._socketBinds['end'] = this._onSocketEnd.bind(this);

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
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Error on connection: ${this._socket.remotePort} - ${err}`);
        this._client.onSocketError(this._socket, err);
    }

    protected _onSocketClose() {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Close on connection: ${this._socket.remotePort}`);
        this._client.onSocketClose(this._socket);
    }

    protected _onSocketEnd() {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Close on connection: ${this._socket.remotePort}`);
        // this._client.onSocketClose(this._socket);
    }
}


/** @internal */
export class IpcBusBrokerImpl implements Broker.IpcBusBroker, IpcBusBrokerSocketClient {
    private _ipcBusBrokerClient: Client.IpcBusClient;
    private _socketClients: Map<net.Socket, IpcBusBrokerSocket>;

    private _socketBridge: net.Socket;
    private _bridgeChannels: Set<string>;

    private _server: net.Server;
    private _netBinds: { [key: string]: (...args: any[]) => void };

    private _promiseStarted: Promise<void>;

    private _subscriptions: IpcBusUtils.ChannelConnectionMap<net.Socket>;
    private _ipcBusPeers: Map<string, Client.IpcBusPeer>;

    constructor(contextType: Client.IpcBusProcessType) {
        // Callbacks
        this._netBinds = {};
        this._netBinds['error'] = this._onServerError.bind(this);
        this._netBinds['close'] = this._onServerClose.bind(this);
        this._netBinds['connection'] = this._onServerConnection.bind(this);

        this._onQueryState = this._onQueryState.bind(this);

        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<net.Socket>('IPCBus:Broker', true);
        this._socketClients = new Map<net.Socket, IpcBusBrokerSocket>();
        this._ipcBusPeers = new Map<string, Client.IpcBusPeer>();

        this._bridgeChannels = new Set<string>();

        this._subscriptions.on('channel-added', (channel: string) => {
            this._socketBridge && this.brokerAddChannels([channel]);
        });

        this._subscriptions.on('channel-removed', (channel: string) => {
            this._socketBridge && this.brokerRemoveChannels([channel]);
        });

        this._ipcBusBrokerClient = CreateIpcBusClientNet(contextType);
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

    private _reset(closeServer: boolean) {
        if (this._server) {
            const server = this._server;
            this._server = null;
            for (let key in this._netBinds) {
                server.removeListener(key, this._netBinds[key]);
            }

            this._ipcBusBrokerClient.removeListener(Client.IPCBUS_CHANNEL_QUERY_STATE, this._onQueryState);
            this._ipcBusBrokerClient.close();

            this._socketClients.forEach((socket) => {
                socket.release();
            });
            this._socketBridge = null;

            server.close();
            server.unref();
        }
        this._promiseStarted = null;
        this._socketClients.clear();
        this._ipcBusPeers.clear();
        this._subscriptions.clear();
    }

    // IpcBusBroker API
    connect(arg1: Broker.IpcBusBroker.ConnectOptions | string | number, arg2?: Broker.IpcBusBroker.ConnectOptions | string, arg3?: Broker.IpcBusBroker.ConnectOptions): Promise<void> {
        const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
        if ((options.port == null && options.path == null)) {
            return Promise.reject('Wrong options');
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

                    this._ipcBusBrokerClient.connect(options)
                        .then(() => {
                            this._ipcBusBrokerClient.addListener(Client.IPCBUS_CHANNEL_QUERY_STATE, this._onQueryState);
                            resolve();
                        })
                        .catch((err) => {
                            this._reset(true);
                            const msg = `[IPCBus:Broker] error = ${err}`;
                            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                            reject(msg);
                        });
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
        this._subscriptions.releaseConnection(socket);
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Connection closed !`);
    }

    protected _onSocketConnected(socket: net.Socket): void {
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
            if (this._socketBridge === socket) {
                this._socketBridge = null;
            }
            this._socketClients.delete(socket);
            this._socketCleanUp(socket);
        }
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
            case IpcBusCommand.Kind.Connect:
                this._ipcBusPeers.set(ipcBusCommand.peer.id, ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.Disconnect:
                if (this._ipcBusPeers.delete(ipcBusCommand.peer.id)) {
                    this._subscriptions.releasePeerId(socket, ipcBusCommand.peer.id);
                }
                break;

            case IpcBusCommand.Kind.Close:
                this._socketCleanUp(socket);
                break;

            case IpcBusCommand.Kind.AddChannelListener:
                this._subscriptions.addRef(ipcBusCommand.channel, socket, ipcBusCommand.peer.id);
                break;

            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                this._subscriptions.releaseAll(ipcBusCommand.channel, socket, ipcBusCommand.peer.id);
                break;

            case IpcBusCommand.Kind.RemoveChannelListener:
                this._subscriptions.release(ipcBusCommand.channel, socket, ipcBusCommand.peer.id);
                break;

            case IpcBusCommand.Kind.RemoveListeners:
                this._subscriptions.releasePeerId(socket, ipcBusCommand.peer.id);
                break;

            case IpcBusCommand.Kind.SendMessage:
                if (this._bridgeChannels.has(ipcBusCommand.channel)) {
                    this._socketBridge && this._socketBridge.write(packet.buffer);
                }
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
                    connData.conn.write(packet.buffer);
                });
                break;
            case IpcBusCommand.Kind.BridgeSendMessage:
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
                    connData.conn.write(packet.buffer);
                });
                break;

            case IpcBusCommand.Kind.RequestMessage:
                // Register the replyChannel
                this._subscriptions.setRequestChannel(ipcBusCommand.request.replyChannel, socket);
                if (this._bridgeChannels.has(ipcBusCommand.channel)) {
                    this._socketBridge && this._socketBridge.write(packet.buffer);
                }
                // Request ipcBusCommand to subscribed connections
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
                    connData.conn.write(packet.buffer);
                });
                break;
            case IpcBusCommand.Kind.BridgeRequestMessage:
                // Register the replyChannel
                this._subscriptions.setRequestChannel(ipcBusCommand.request.replyChannel, socket);
                // Request ipcBusCommand to subscribed connections
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
                    connData.conn.write(packet.buffer);
                });
                break;

            case IpcBusCommand.Kind.RequestResponse:
            case IpcBusCommand.Kind.BridgeRequestResponse: {
                const replySocket = this._subscriptions.getRequestChannel(ipcBusCommand.request.replyChannel);
                if (replySocket) {
                    this._subscriptions.deleteRequestChannel(ipcBusCommand.request.replyChannel);
                    replySocket.write(packet.buffer);
                }
                break;
            }

            case IpcBusCommand.Kind.RequestCancel:
            case IpcBusCommand.Kind.BridgeRequestCancel:
                this._subscriptions.deleteRequestChannel(ipcBusCommand.request.replyChannel);
                break;

            case IpcBusCommand.Kind.BridgeAddChannels: {
                const channels: string[] = packet.parseArrayAt(1);
                channels.forEach(channel => {
                    this._bridgeChannels.add(channel);
                });
                break;
            }

            case IpcBusCommand.Kind.BridgeRemoveChannels: {
                const channels: string[] = packet.parseArrayAt(1);
                channels.forEach(channel => {
                    this._bridgeChannels.delete(channel);
                });
                break;
            }

            case IpcBusCommand.Kind.BridgeConnect: {
                this._socketBridge = socket;
                this._bridgeChannels.clear();
                const channels = this._subscriptions.getChannels();
                this.brokerAddChannels(channels);
                break;
            }

            case IpcBusCommand.Kind.BridgeClose:
                this._socketBridge = null;
                this._bridgeChannels.clear();
                break;

            default:
                console.log(JSON.stringify(ipcBusCommand, null, 4));
                throw 'IpcBusBrokerImpl: Not valid packet !';
        }
    }

    private brokerAddChannels(channels: string[]) {
        const ipcBusCommand: IpcBusCommand = {
            kind: IpcBusCommand.Kind.BrokerAddChannels,
            channel: '',
            peer: this._ipcBusBrokerClient.peer
        };
        const socketWriter = new SocketWriter(this._socketBridge);
        const ipcPacketBuffer = new IpcPacketBuffer();
        ipcPacketBuffer.writeArray(socketWriter, [ipcBusCommand, channels]);
    }

    private brokerRemoveChannels(channels: string[]) {
        const ipcBusCommand: IpcBusCommand = {
            kind: IpcBusCommand.Kind.BrokerRemoveChannels,
            channel: '',
            peer: this._ipcBusBrokerClient.peer
        };
        const socketWriter = new SocketWriter(this._socketBridge);
        const ipcPacketBuffer = new IpcPacketBuffer();
        ipcPacketBuffer.writeArray(socketWriter, [ipcBusCommand, channels]);
    }

    queryState(): Object {
        const queryStateResult: Object[] = [];
        this._subscriptions.forEach((connData, channel) => {
            connData.peerIds.forEach((peerIdRefCount) => {
                queryStateResult.push({ channel: channel, peer: this._ipcBusPeers.get(peerIdRefCount.peerId), count: peerIdRefCount.refCount });
            });
        });
        return queryStateResult;
    }
}
