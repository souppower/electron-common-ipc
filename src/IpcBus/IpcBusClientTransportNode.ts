/// <reference types='node' />

import * as assert from 'assert';
import * as net from 'net';

import { IpcPacketBufferWrap, IpcPacketBuffer, Writer, SocketWriter, BufferedSocketWriter, DelayedSocketWriter, BufferListReader } from 'socket-serializer';

import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusClientTransport } from './IpcBusClientTransport';
import { IpcBusCommand } from './IpcBusCommand';

// Implementation for Node process
/** @internal */
export class IpcBusClientTransportNode extends IpcBusClientTransport {
    private _promiseConnected: Promise<void>;

    protected _socket: net.Socket;
    protected _netBinds: { [key: string]: Function };

    private _socketBuffer: number;
    private _socketWriter: Writer;

    protected _packetOut: IpcPacketBufferWrap;

    protected _packetIn: IpcPacketBuffer;
    private _bufferListReader: BufferListReader;

    constructor(processType: IpcBusInterfaces.IpcBusProcessType, options: IpcBusInterfaces.IpcBusClient.CreateOptions) {
        assert((processType === 'browser') || (processType === 'node'), `IpcBusClientTransportNode: processType must not be a process ${processType}`);

        super({ type: processType, pid: process.pid }, options);
        this._packetOut = new IpcPacketBufferWrap();

        this._bufferListReader = new BufferListReader();
        this._packetIn = new IpcPacketBuffer();

        this._netBinds = {};
        this._netBinds['error'] = this._onSocketError.bind(this);
        this._netBinds['close'] = this._onSocketClose.bind(this);
        this._netBinds['data'] = this._onSocketData.bind(this);
        this._netBinds['end'] = this._onSocketEnd.bind(this);
    }

    protected _onSocketError(err: any) {
        let msg = `[IPCBus:Node] server error ${err}`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
        this._socket.destroy();
        this._reset();
    }

    protected _onSocketClose() {
        let msg = `[IPCBus:Node] server close`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(msg);
        this._reset();
    }

    protected _onSocketEnd() {
        let msg = `[IPCBus:Node] server end`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(msg);
        this._reset();
    }

    protected _onSocketData(buffer: Buffer) {
        this._bufferListReader.appendBuffer(buffer);
        while (this._packetIn.decodeFromReader(this._bufferListReader)) {
            let ipcBusCommand: IpcBusCommand = this._packetIn.parseArrayAt(0);
            if (ipcBusCommand && ipcBusCommand.peer) {
                this._onEventReceived(this._packetIn);
            }
            else {
                throw `[IPCBus:Node] Not valid packet !`;
            }
            // Remove read buffer
            this._bufferListReader.reduce();
        }
    }

    protected _reset() {
        this._promiseConnected = null;
        this._socketWriter = null;
        if (this._socket) {
            let socket = this._socket;
            this._socket = null;
            for (let key in this._netBinds) {
                socket.removeListener(key, this._netBinds[key]);
            }

            socket.end();
            socket.unref();
        }
    }

    /// IpcBusClientTransport API
    protected ipcConnect(options?: IpcBusInterfaces.IpcBusClient.ConnectOptions): Promise<void> {
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
                    let msg = `[IPCBus:Node] error = ${err} on ${JSON.stringify(this._netOptions)}`;
                    fctReject(msg);
                };

                let catchClose = () => {
                    let msg = `[IPCBus:Node] server close`;
                    fctReject(msg);
                };

                let socket = new net.Socket();
                let socketLocalBinds: { [key: string]: Function } = {};
                let catchOpen = (conn: any) => {
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
                };

                fctReject = (msg: string) => {
                    if (timer) {
                        clearTimeout(timer);
                    }
                    for (let key in socketLocalBinds) {
                        socket.removeListener(key, socketLocalBinds[key]);
                    }
                    this._reset();
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                    reject(msg);
                };
                socketLocalBinds['error'] = catchError.bind(this);
                socketLocalBinds['close'] = catchClose.bind(this);
                socketLocalBinds['connect'] = catchOpen.bind(this);
                for (let key in socketLocalBinds) {
                    socket.addListener(key, socketLocalBinds[key]);
                }
                if (this._netOptions.path) {
                    socket.connect(this._netOptions.path);
                }
                else {
                    socket.connect(this._netOptions.port, this._netOptions.host);
                }
            });
        }
        return p;
    }

    protected ipcClose(options?: IpcBusInterfaces.IpcBusClient.CloseOptions): Promise<void> {
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
                this._reset();
            }
            else {
                resolve();
            }
        });
    }

    protected ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        if (this._socket) {
            if (args) {
                this._packetOut.writeArray(this._socketWriter, [ipcBusCommand, ...args]);
            }
            else {
                this._packetOut.writeArray(this._socketWriter, [ipcBusCommand]);
            }
        }
    }
}
