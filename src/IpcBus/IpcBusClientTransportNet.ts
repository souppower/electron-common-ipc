import * as assert from 'assert';
import * as net from 'net';

import { IpcPacketBufferWrap, IpcPacketBuffer, Writer, SocketWriter, BufferedSocketWriter, DelayedSocketWriter, BufferListReader } from 'socket-serializer';

import * as IpcBusUtils from './IpcBusUtils';
import * as Client from './IpcBusClient';

import { IpcBusClientTransport } from './IpcBusClientTransport';
import { IpcBusCommand } from './IpcBusCommand';

// Implementation for Node process
/** @internal */
export class IpcBusClientTransportNet extends IpcBusClientTransport {
    private _promiseConnected: Promise<void>;

    protected _socket: net.Socket;
    protected _netBinds: { [key: string]: Function };

    private _socketBuffer: number;
    private _socketWriter: Writer;

    protected _packetOut: IpcPacketBufferWrap;

    protected _packetIn: IpcPacketBuffer;
    private _bufferListReader: BufferListReader;

    constructor(contextType: Client.IpcBusProcessType, options: Client.IpcBusClient.CreateOptions) {
        assert((contextType === 'main') || (contextType === 'node'), `IpcBusClientTransportNet: contextType must not be a ${contextType}`);

        super({ type: contextType, pid: process.pid }, options);
        this._packetOut = new IpcPacketBufferWrap();

        this._bufferListReader = new BufferListReader();
        this._packetIn = new IpcPacketBuffer();

        this._netBinds = {};
        this._netBinds['error'] = this._onSocketError.bind(this);
        this._netBinds['close'] = this._onSocketClose.bind(this);
        this._netBinds['data'] = this._onSocketData.bind(this);
        this._netBinds['end'] = this._onSocketEnd.bind(this);
    }

    // https://nodejs.org/api/net.html#net_event_error_1
    protected _onSocketError(err: any) {
        let msg = `[IPCBus:Node] socket error ${err}`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
        // this._socket.destroy();
        // this._reset();
    }

    // https://nodejs.org/api/net.html#net_event_close_1
    protected _onSocketClose() {
        let msg = `[IPCBus:Node] socket close`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(msg);
        this._reset(false);
    }

    // https://nodejs.org/api/net.html#net_event_end
    protected _onSocketEnd() {
        let msg = `[IPCBus:Node] socket end`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(msg);
        this._reset(false);
    }

    // https://nodejs.org/api/net.html#net_event_data
    protected _onSocketData(buffer: Buffer) {
        this._bufferListReader.appendBuffer(buffer);
        while (this._packetIn.decodeFromReader(this._bufferListReader)) {
            let ipcBusCommand: IpcBusCommand = this._packetIn.parseArrayAt(0);
            if (ipcBusCommand && ipcBusCommand.peer) {
                this._onEventReceived(ipcBusCommand, this._packetIn);
            }
            else {
                throw `[IPCBus:Node] Not valid packet !`;
            }
            // Remove read buffer
            this._bufferListReader.reduce();
        }
    }

    protected _reset(endSocket: boolean) {
        this._promiseConnected = null;
        this._socketWriter = null;
        if (this._socket) {
            let socket = this._socket;
            this._socket = null;
            for (let key in this._netBinds) {
                socket.removeListener(key, this._netBinds[key]);
            }
            if (endSocket) {
                socket.end();
            }
        }
    }

    /// IpcBusClientTransport API
    protected ipcConnect(options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        // Store in a local variable, in case it is set to null (paranoid code as it is asynchronous!)
        let p = this._promiseConnected;
        if (!p) {
            options = options || {};
            if (options.timeoutDelay == null) {
                options.timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
            }
            p = this._promiseConnected = new Promise<void>((resolve, reject) => {
                this._ipcBusPeer.name = options.peerName || `${this._ipcBusPeer.process.type}_${this._ipcBusPeer.process.pid}`;
                this._socketBuffer = options.socketBuffer;

                let timer: NodeJS.Timer = null;
                let fctReject: (msg: string) => void;
                // Below zero = infinite
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        timer = null;
                        let msg = `[IPCBus:Node] error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(this._netOptions)}`;
                        fctReject(msg);
                    }, options.timeoutDelay);
                }

                let catchError = (err: any) => {
                    let msg = `[IPCBus:Node] socket error = ${err} on ${JSON.stringify(this._netOptions)}`;
                    fctReject(msg);
                };

                let catchClose = () => {
                    let msg = `[IPCBus:Node] socket close`;
                    fctReject(msg);
                };

                let socket = new net.Socket();
                socket.unref();
                let socketLocalBinds: { [key: string]: Function } = {};
                let catchConnect = (conn: any) => {
                    // timeout or error has been already trigerred
                    if (timer == null) {
                        socket.destroy();
                    }
                    else {
                        clearTimeout(timer);
                        for (let key in socketLocalBinds) {
                            socket.removeListener(key, socketLocalBinds[key]);
                        }
                        this._socket = socket;
                        for (let key in this._netBinds) {
                            this._socket.addListener(key, this._netBinds[key]);
                        }

                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Node] connected on ${JSON.stringify(this._netOptions)}`);
                        if ((this._socketBuffer == null) || (this._socketBuffer === 0)) {
                            this._socketWriter = new SocketWriter(this._socket);
                        }
                        else if (this._socketBuffer < 0) {
                            this._socketWriter = new DelayedSocketWriter(this._socket);
                        }
                        else if (this._socketBuffer > 0) {
                            this._socketWriter = new BufferedSocketWriter(this._socket, this._socketBuffer);
                        }
                        this.ipcSend(IpcBusCommand.Kind.Connect, '');
                        resolve();
                    }
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
                if (this._netOptions.path) {
                    socket.connect(this._netOptions.path);
                }
                else if (this._netOptions.port && this._netOptions.host) {
                    socket.connect(this._netOptions.port, this._netOptions.host);
                }
                else  {
                    socket.connect(this._netOptions.port);
                }
            });
        }
        return p;
    }

    protected ipcClose(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        options = options || {};
        if (options.timeoutDelay == null) {
            options.timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        return new Promise<void>((resolve, reject) => {
            if (this._socket) {
                let timer: NodeJS.Timer;
                let socket = this._socket;
                let socketLocalBinds: { [key: string]: Function } = {};
                let catchClose = () => {
                    clearTimeout(timer);
                    for (let key in socketLocalBinds) {
                        socket.removeListener(key, socketLocalBinds[key]);
                    }
                    resolve();
                };
                // Below zero = infinite
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        for (let key in socketLocalBinds) {
                            socket.removeListener(key, socketLocalBinds[key]);
                        }
                        let msg = `[IPCBus:Node] stop, error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(this._netOptions)}`;
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                        reject(msg);
                    }, options.timeoutDelay);
                }
                socketLocalBinds['close'] = catchClose.bind(this);
                for (let key in socketLocalBinds) {
                    socket.addListener(key, socketLocalBinds[key]);
                }
                this.ipcSend(IpcBusCommand.Kind.Close, '');
                this._reset(true);
            }
            else {
                resolve();
            }
        });
    }

    protected ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        if (this._socketWriter) {
            if (args) {
                this._packetOut.writeArray(this._socketWriter, [ipcBusCommand, args]);
            }
            else {
                this._packetOut.writeArray(this._socketWriter, [ipcBusCommand]);
            }
        }
    }
}
