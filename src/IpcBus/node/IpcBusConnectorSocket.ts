import * as assert from 'assert';
import * as net from 'net';

import { IpcPacketContent, IpcPacketBufferList, Writer, SocketWriter, BufferedSocketWriter, DelayedSocketWriter, BufferListReader } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import type * as Client from '../IpcBusClient';

import type { IpcBusCommand } from '../IpcBusCommand';
import type { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusConnectorImpl } from '../IpcBusConnectorImpl';
import { WriteBuffersToSocket } from './IpcBusBrokerImpl';

// Implementation for Node process
/** @internal */
export class IpcBusConnectorSocket extends IpcBusConnectorImpl {
    private _socket: net.Socket;
    private _netBinds: { [key: string]: (...args: any[]) => void };

    private _connectCloseState: IpcBusUtils.ConnectCloseState<IpcBusConnector.Handshake>;

    private _socketBuffer: number;
    private _socketWriter: Writer;

    private _packetIn: IpcPacketBufferList;
    private _packetOut: IpcPacketContent;

    private _bufferListReader: BufferListReader;

    constructor(contextType: Client.IpcBusProcessType) {
        assert((contextType === 'main') || (contextType === 'node'), `IpcBusTransportNet: contextType must not be a ${contextType}`);
        super(contextType);

        this._bufferListReader = new BufferListReader();
        this._packetIn = new IpcPacketBufferList();
        this._packetOut = new IpcPacketContent();

        this._connectCloseState = new IpcBusUtils.ConnectCloseState<IpcBusConnector.Handshake>();

        this._netBinds = {};
        this._netBinds['error'] = this._onSocketError.bind(this);
        this._netBinds['close'] = this._onSocketClose.bind(this);
        this._netBinds['data'] = this._onSocketData.bind(this);
        this._netBinds['end'] = this._onSocketEnd.bind(this);
    }
    
    // https://nodejs.org/api/net.html#net_event_error_1
    protected _onSocketError(err: any) {
        const msg = `[IPCBusTransport:Net ${this._messageId}] socket error ${err}`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
        // this._socket.destroy();
        this._reset(false);
    }

    // https://nodejs.org/api/net.html#net_event_close_1
    protected _onSocketClose() {
        const msg = `[IPCBusTransport:Net ${this._messageId}] socket close`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(msg);
        this._reset(false);
    }

    // https://nodejs.org/api/net.html#net_event_end
    protected _onSocketEnd() {
        const msg = `[IPCBusTransport:Net ${this._messageId}] socket end`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(msg);
        this._reset(false);
    }

    // https://nodejs.org/api/net.html#net_event_data
    protected _onSocketData(buffer: Buffer) {
        this._bufferListReader.appendBuffer(buffer);
        while (this._packetIn.decodeFromReader(this._bufferListReader)) {
        // while (this._packetIn.keepDecodingFromReader(this._bufferListReader)) {
            const ipcBusCommand: IpcBusCommand = this._packetIn.parseArrayAt(0);
            this._client.onConnectorPacketReceived(ipcBusCommand, this._packetIn);
            // this._packetIn.reset();
        }
        // Remove read buffer
        this._bufferListReader.reduce();
    }

    protected _reset(endSocket: boolean) {
        this._connectCloseState.shutdown();
        if (this._client) {
            this._client.onConnectorShutdown();
            this.removeClient(this._client);
        }
        this._socketWriter = null;
        if (this._socket) {
            const socket = this._socket;
            this._socket = null;
            for (let key in this._netBinds) {
                socket.removeListener(key, this._netBinds[key]);
            }
            if (endSocket) {
                socket.end();
            }
        }
    }

    /// IpcBusTransportImpl API
    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        return this._connectCloseState.connect(() => {
            return new Promise((resolve, reject) => {
                options = IpcBusUtils.CheckConnectOptions(options);
                if ((options.port == null) && (options.path == null)) {
                    return reject('Connection options not provided');
                }

                this._socketBuffer = options.socketBuffer;

                let timer: NodeJS.Timer = null;
                let fctReject: (msg: string) => void;
                // Below zero = infinite
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        timer = null;
                        const msg = `[IPCBusTransport:Net ${this._messageId}] error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(options)}`;
                        fctReject(msg);
                    }, options.timeoutDelay);
                }

                const catchError = (err: any) => {
                    const msg = `[IPCBusTransport:Net ${this._messageId}] socket error = ${err} on ${JSON.stringify(options)}`;
                    fctReject(msg);
                };

                const catchClose = () => {
                    const msg = `[IPCBusTransport:Net ${this._messageId}] socket close`;
                    fctReject(msg);
                };

                const socket = new net.Socket();
                socket.unref();
                let socketLocalBinds: { [key: string]: (...args: any[]) => void } = {};
                const catchConnect = () => {
                    clearTimeout(timer);

                    this.addClient(client);
                    for (let key in socketLocalBinds) {
                        socket.removeListener(key, socketLocalBinds[key]);
                    }
                    this._socket = socket;
                    for (let key in this._netBinds) {
                        this._socket.addListener(key, this._netBinds[key]);
                    }

                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport:Net ${this._messageId}] connected on ${JSON.stringify(options)}`);
                    if ((this._socketBuffer == null) || (this._socketBuffer === 0)) {
                        this._socketWriter = new SocketWriter(this._socket);
                    }
                    else if (this._socketBuffer < 0) {
                        this._socketWriter = new DelayedSocketWriter(this._socket);
                    }
                    else if (this._socketBuffer > 0) {
                        this._socketWriter = new BufferedSocketWriter(this._socket, this._socketBuffer);
                    }

                    const handshake: IpcBusConnector.Handshake = {
                        process: this.process,
                        logLevel: this._log.level
                    }
                    resolve(handshake);
                };

                fctReject = (msg: string) => {
                    clearTimeout(timer);
                    for (let key in socketLocalBinds) {
                        socket.removeListener(key, socketLocalBinds[key]);
                    }
                    this._reset(false);
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                    reject(msg);
                };
                socketLocalBinds['error'] = catchError.bind(this);
                socketLocalBinds['close'] = catchClose.bind(this);
                socketLocalBinds['connect'] = catchConnect.bind(this);
                for (let key in socketLocalBinds) {
                    socket.addListener(key, socketLocalBinds[key]);
                }
                if (options.path) {
                    socket.connect(options.path);
                }
                else if (options.port && options.host) {
                    socket.connect(options.port, options.host);
                }
                else  {
                    socket.connect(options.port);
                }
            });
        });
    }

    shutdown(client: IpcBusConnector.Client, options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        return this._connectCloseState.close(() => {
            options = options || {};
            if (options.timeoutDelay == null) {
                options.timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
            }
            return new Promise<void>((resolve, reject) => {
                if (this._socket) {
                    let timer: NodeJS.Timer;
                    const socket = this._socket;
                    let socketLocalBinds: { [key: string]: (...args: any[]) => void } = {};
                    const catchClose = () => {
                        clearTimeout(timer);
                        for (let key in socketLocalBinds) {
                            socket.removeListener(key, socketLocalBinds[key]);
                        }
                        this.removeClient(client);
                        resolve();
                    };
                    // Below zero = infinite
                    if (options.timeoutDelay >= 0) {
                        timer = setTimeout(() => {
                            for (let key in socketLocalBinds) {
                                socket.removeListener(key, socketLocalBinds[key]);
                            }
                            const msg = `[IPCBusTransport:Net ${this._messageId}] stop, error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(options)}`;
                            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                            reject(msg);
                        }, options.timeoutDelay);
                    }
                    socketLocalBinds['close'] = catchClose.bind(this);
                    for (let key in socketLocalBinds) {
                        socket.addListener(key, socketLocalBinds[key]);
                    }
                    this._reset(true);
                }
                else {
                    resolve();
                }
            });
        });
    }

    postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        if (this._socketWriter) {
            // this._logLevel && this.trackCommandPost(ipcBusCommand, args);
            // Beware of C++ code expecting an array with 1 or 2 parameters but not 2 with the second one undefined
            if (args) {
                this._packetOut.writeArray(this._socketWriter, [ipcBusCommand, args]);
            }
            else {
                this._packetOut.writeArray(this._socketWriter, [ipcBusCommand]);
            }
        }
    }

    postBuffers(buffers: Buffer[]) {
        if (this._socket) {
            WriteBuffersToSocket(this._socket, buffers);
        }
    }
}
