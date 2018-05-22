import { IpcPacketNet } from 'socket-serializer';
import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';
// import * as util from 'util';

import { IpcBusCommonClient } from './IpcBusClient';
import { IpcBusTransport } from './IpcBusTransport';
import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusTransportNode } from './IpcBusTransportNode';

/** @internal */
export class IpcBusBrokerImpl implements IpcBusInterfaces.IpcBusBroker {
    private _baseIpc: IpcPacketNet;
    private _ipcOptions: IpcBusUtils.IpcOptions;
    private _ipcBusBrokerClient: IpcBusCommonClient;

    private _promiseStarted: Promise<void>;

    private _subscriptions: IpcBusUtils.ChannelConnectionMap<string>;
    private _requestChannels: Map<string, any>;
    private _ipcBusPeers: Map<string, IpcBusInterfaces.IpcBusPeer>;

    private _queryStateLamdba: IpcBusInterfaces.IpcBusListener = (ipcBusEvent: IpcBusInterfaces.IpcBusEvent, replyChannel: string) => this._onQueryState(ipcBusEvent, replyChannel);
    private _serviceAvailableLambda: IpcBusInterfaces.IpcBusListener = (ipcBusEvent: IpcBusInterfaces.IpcBusEvent, serviceName: string) => this._onServiceAvailable(ipcBusEvent, serviceName);

    private _onServerDataBind: Function;
    private _onServerConnectionBind: Function;
    private _onServerCloseBind: Function;
    private _onServerErrorBind: Function;

    constructor(processType: IpcBusInterfaces.IpcBusProcessType, ipcOptions: IpcBusUtils.IpcOptions) {
        this._ipcOptions = ipcOptions;

        this._onServerDataBind = this._onServerData.bind(this);
        this._onServerConnectionBind = this._onServerConnection.bind(this);
        this._onServerCloseBind = this._onServerClose.bind(this);
        this._onServerErrorBind = this._onServerError.bind(this);

        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<string>('IPCBus:Broker');
        this._requestChannels = new Map<string, any>();
        this._ipcBusPeers = new Map<string, IpcBusInterfaces.IpcBusPeer>();

        let ipcBusTransport: IpcBusTransport = new IpcBusTransportNode(processType, ipcOptions);
        this._ipcBusBrokerClient = new IpcBusCommonClient(ipcBusTransport);
    }

    private _reset() {
        this._promiseStarted = null;
        if (this._baseIpc) {
            this._ipcBusBrokerClient.close();
            this._baseIpc.server.removeListener('connection', this._onServerConnectionBind);
            this._baseIpc.server.removeListener('error', this._onServerErrorBind);
            this._baseIpc.server.removeListener('close', this._onServerCloseBind);
            this._baseIpc.removeListener('packet', this._onServerDataBind);
            this._baseIpc.server.close();
            this._baseIpc = null;
        }
    }

    // IpcBusBroker API
    start(options?: IpcBusInterfaces.IpcBusBroker.StartOptions): Promise<void> {
        options = options || {};
        if (options.timeoutDelay == null) {
            options.timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        // Store in a local variable, in case it is set to null (paranoid code as it is asynchronous!)
        let p = this._promiseStarted;
        if (!p) {
            p = this._promiseStarted = new Promise<void>((resolve, reject) => {
                let baseIpc = new IpcPacketNet();
                let timer: NodeJS.Timer = null;
                let fctReject: (msg: string) => void;

                // Below zero = infinite
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        timer = null;
                        let msg = `[IPCBus:Broker] error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(this._ipcOptions)}`;
                        fctReject(msg);
                    }, options.timeoutDelay);
                }

                let catchError = (err: any) => {
                    let msg = `[IPCBus:Broker] error = ${err} on ${JSON.stringify(this._ipcOptions)}`;
                    fctReject(msg);
                };

                let catchClose = () => {
                    let msg = `[IPCBus:Broker] close on ${JSON.stringify(this._ipcOptions)}`;
                    fctReject(msg);
                };

                let catchListening =  (server: any) => {
                    clearTimeout(timer);
                    baseIpc.server.removeListener('listening', catchListening);
                    baseIpc.server.removeListener('error', catchError);
                    baseIpc.server.removeListener('close', catchClose);

                    this._baseIpc = baseIpc;

                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Listening for incoming connections on ${JSON.stringify(this._ipcOptions)}`);
                    this._baseIpc.server.on('connection', this._onServerConnectionBind);
                    this._baseIpc.server.on('error', this._onServerErrorBind);
                    this._baseIpc.server.on('close', this._onServerCloseBind);
                    this._baseIpc.on('packet', this._onServerDataBind);

                    this._ipcBusBrokerClient.connect({ peerName: `IpcBusBrokerClient` })
                        .then(() => {
                            this._ipcBusBrokerClient.on(IpcBusInterfaces.IPCBUS_CHANNEL_QUERY_STATE, this._queryStateLamdba);
                            this._ipcBusBrokerClient.on(IpcBusInterfaces.IPCBUS_CHANNEL_SERVICE_AVAILABLE, this._serviceAvailableLambda);
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
                    baseIpc.server.removeListener('listening', catchListening);
                    baseIpc.server.removeListener('error', catchError);
                    baseIpc.server.removeListener('close', catchClose);
                    this._reset();
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                    reject(msg);
                };

                baseIpc.listen(this._ipcOptions.port, this._ipcOptions.host);
                baseIpc.server.addListener('listening', catchListening);
                baseIpc.server.addListener('error', catchError);
                baseIpc.server.addListener('close', catchClose);
            });
        }
        return p;
    }

    stop(options?: IpcBusInterfaces.IpcBusBroker.StopOptions): Promise<void> {
        options = options || {};
        if (options.timeoutDelay == null) {
            options.timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        return new Promise<void>((resolve, reject) => {
            if (this._baseIpc) {
                let timer: NodeJS.Timer;
                let baseIpc = this._baseIpc;

                let catchClose = () => {
                    clearTimeout(timer);
                    baseIpc.server.removeListener('close', catchClose);
                    resolve();
                };
                // Below zero = infinite
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        baseIpc.server.removeListener('close', catchClose);

                        let msg = `[IPCBus:Broker] stop, error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(this._ipcOptions)}`;
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                        reject(msg);
                    }, options.timeoutDelay);
                }

                // this._ipcServer.on('close', (conn: any) => {
                //     clearTimeout(timer);
                //     resolve();
                // });
                // this._ipcServer.on('error', (conn: any) => {
                //     clearTimeout(timer);
                //     resolve();
                // });
                // this._reset();
            }
            else {
                resolve();
            }
        });
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

    isServiceAvailable(serviceName: string): boolean {
        return this._subscriptions.hasChannel(IpcBusUtils.getServiceCallChannel(serviceName));
    }

    protected _onQueryState(ipcBusEvent: IpcBusInterfaces.IpcBusEvent, replyChannel: string) {
        const queryState = this.queryState();
        if (ipcBusEvent.request) {
            ipcBusEvent.request.resolve(queryState);
        }
        else if (replyChannel != null) {
            this._ipcBusBrokerClient.send(replyChannel, queryState);
        }
    }

    protected _onServiceAvailable(ipcBusEvent: IpcBusInterfaces.IpcBusEvent, serviceName: string) {
        const availability = this.isServiceAvailable(serviceName);
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Service '${serviceName}' availability : ${availability}`);
        if (ipcBusEvent.request) {
            ipcBusEvent.request.resolve(availability);
        }
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

    protected _onSocketClose(socket: any): void {
        this._socketCleanUp(socket);
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

    protected _onServerConnection(socket: any, server: any): void {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Incoming connection !`);
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.address=' + JSON.stringify(socket.address()));
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.localAddress=' + socket.localAddress);
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.remoteAddress=' + socket.remoteAddress);
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.remotePort=' + socket.remotePort);
        socket.on('error', (err: string) => {
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Error on connection: ${err}`);
        });
        socket.on('close', () => {
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Close on connection: ${socket.remoteAddress}`);
            this._onSocketClose(socket);
        });
    }

    protected _onServerData(packet: IpcPacketBuffer, socket: any, server: any): void {
        let ipcBusCommand: IpcBusCommand = packet.parseArrayAt(0);
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.Connect:
                this._ipcBusPeers.set(ipcBusCommand.peer.id, ipcBusCommand.peer);
                break;

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
                // Send ipcBusCommand to subscribed connections
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
                    connData.conn.write(packet.buffer);
                });
                break;

            case IpcBusCommand.Kind.RequestMessage:
                // Register on the replyChannel
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
                    // Send ipcBusCommand to subscribed connections
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
}
