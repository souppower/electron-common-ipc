/// <reference types='node' />

import * as assert from 'assert';
import * as net from 'net';

import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusTransport } from './IpcBusTransport';
import { IpcBusCommand } from './IpcBusCommand';

import { IpcPacketBufferWrap, IpcPacketBuffer, Writer, SocketWriter, BufferedSocketWriter, DelayedSocketWriter, BufferListReader } from 'socket-serializer';

// Implementation for Node process
/** @internal */
export class IpcBusTransportNode extends IpcBusTransport {
    private _promiseConnected: Promise<void>;

    protected _socket: net.Socket;
    protected _socketBinds: { [key: string]: Function };

    private _socketBuffer: number;
    private _socketWriter: Writer;

    private _packet: IpcPacketBufferWrap;
    private _packetBuffer: IpcPacketBuffer;
    private _bufferListReader: BufferListReader;

    constructor(processType: IpcBusInterfaces.IpcBusProcessType, ipcOptions: IpcBusUtils.IpcOptions) {
        assert((processType === 'browser') || (processType === 'node'), `IpcBusTransportNode: processType must not be a process ${processType}`);

        super({ type: processType, pid: process.pid }, ipcOptions);
        this._packet = new IpcPacketBufferWrap();
        this._bufferListReader = new BufferListReader();
        this._packetBuffer = new IpcPacketBuffer();

        this._socketBinds = {};
        this._socketBinds['error'] = this._onSocketError.bind(this);
        this._socketBinds['close'] = this._onSocketClose.bind(this);
        this._socketBinds['data'] = this._onSocketData.bind(this);
        this._socketBinds['end'] = this._onSocketEnd.bind(this);
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

        while (this._packetBuffer.decodeFromReader(this._bufferListReader)) {
            let args = this._packetBuffer.parseArray();
            let ipcBusCommand: IpcBusCommand = args.shift();
            // console.log(`packet`);
            // console.log(JSON.stringify(ipcBusCommand, null, 4));
            if (ipcBusCommand && ipcBusCommand.peer) {
                this._onEventReceived(ipcBusCommand, args);
            }
            else {
                // console.log(JSON.stringify(ipcBusCommand, null, 4));
                // console.log(args);
                throw `[IPCBus:Node] Not valid packet !`;
            }
        }
    }

    private _reset() {
        this._promiseConnected = null;
        this._socketWriter = null;
        if (this._socket) {
            for (let key in this._socketBinds) {
                this._socket.removeListener(key, this._socketBinds[key]);
            }
            this._socket.end();
            this._socket.unref();
            this._socket = null;
        }
    }

    /// IpcBusTransport API
    ipcConnect(options?: IpcBusInterfaces.IpcBusClient.ConnectOptions): Promise<void> {
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
                        let msg = `[IPCBus:Node] error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(this._ipcOptions)}`;
                        fctReject(msg);
                    }, options.timeoutDelay);
                }

                let catchError = (err: any) => {
                    let msg = `[IPCBus:Node] error = ${err} on ${JSON.stringify(this._ipcOptions)}`;
                    fctReject(msg);
                };

                let catchClose = () => {
                    let msg = `[IPCBus:Node] server close`;
                    fctReject(msg);
                };

                let socket: net.Socket;
                let socketLocalBinds: { [key: string]: Function } = {};
                let catchOpen = (conn: any) => {
                    clearTimeout(timer);
                    for (let key in socketLocalBinds) {
                        socket.removeListener(key, socketLocalBinds[key]);
                    }

                    this._socket = socket;

                    for (let key in this._socketBinds) {
                        this._socket.addListener(key, this._socketBinds[key]);
                    }

                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Node] connected on ${JSON.stringify(this._ipcOptions)}`);
                    if ((this._socketBuffer == null) || (this._socketBuffer === 0)) {
                        this._socketWriter = new SocketWriter(this._socket);
                    }
                    else if (this._socketBuffer < 0) {
                        this._socketWriter = new DelayedSocketWriter(this._socket);
                    }
                    else if (this._socketBuffer > 0) {
                        this._socketWriter = new BufferedSocketWriter(this._socket, this._socketBuffer);
                    }
                    this.ipcPushCommand(IpcBusCommand.Kind.Connect, '');
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
                socket = net.connect(this._ipcOptions.port, this._ipcOptions.host);
                for (let key in socketLocalBinds) {
                    socket.addListener(key, socketLocalBinds[key]);
                }
            });
        }
        return p;
    }

    ipcClose(options?: IpcBusInterfaces.IpcBusClient.CloseOptions): Promise<void> {
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
                    // for (let key in socketLocalBinds) {
                    //     socket.removeListener(key, socketLocalBinds[key]);
                    // }
                    resolve();
                };
                let catchError = () => {
                    clearTimeout(timer);
                    // for (let key in socketLocalBinds) {
                    //     socket.removeListener(key, socketLocalBinds[key]);
                    // }
                    resolve();
                };
                // Below zero = infinite
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        socket.removeListener('close', catchClose);
                        let msg = `[IPCBus:Node] stop, error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(this._ipcOptions)}`;
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                        reject(msg);
                    }, options.timeoutDelay);
                }
                socketLocalBinds['error'] = catchError.bind(this);
                socketLocalBinds['close'] = catchClose.bind(this);
                for (let key in socketLocalBinds) {
                    socket.addListener(key, socketLocalBinds[key]);
                }
                this.ipcPushCommand(IpcBusCommand.Kind.Close, '');
                this._reset();
            }
            else {
                resolve();
            }
        });
    }

    ipcPushCommand(command: IpcBusCommand.Kind, channel: string, ipcBusCommandRequest?: IpcBusCommand.Request, args?: any[]): void {
        this._ipcPushCommand({ kind: command, channel: channel, peer: this.peer, request: ipcBusCommandRequest }, args);
    }

    protected _ipcPushCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        if (this._socket) {
            if (args) {
                this._packet.writeArray(this._socketWriter, [ipcBusCommand, ...args]);
            }
            else {
                this._packet.writeArray(this._socketWriter, [ipcBusCommand]);
            }
        }
    }
}
