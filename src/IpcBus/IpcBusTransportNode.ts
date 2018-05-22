/// <reference types='node' />

import * as assert from 'assert';

import { IpcPacketNet as BaseIpc } from 'socket-serializer';

import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusTransport } from './IpcBusTransport';
import { IpcBusCommand } from './IpcBusCommand';

import { IpcPacketBufferWrap, IpcPacketBuffer, Writer, SocketWriter, BufferedSocketWriter, DelayedSocketWriter } from 'socket-serializer';

// Implementation for Node process
/** @internal */
export class IpcBusTransportNode extends IpcBusTransport {
    protected _baseIpc: BaseIpc;
    private _promiseConnected: Promise<void>;

    private _socketBuffer: number;
    private _socketWriter: Writer;
    private _packet: IpcPacketBufferWrap;

    private _onSocketErrorBind: Function;
    private _onSocketCloseBind: Function;
    private _onSocketPacketBind: Function;

    constructor(processType: IpcBusInterfaces.IpcBusProcessType, ipcOptions: IpcBusUtils.IpcOptions) {
        assert((processType === 'browser') || (processType === 'node'), `IpcBusTransportNode: processType must not be a process ${processType}`);

        super({ type: processType, pid: process.pid }, ipcOptions);
        this._packet = new IpcPacketBufferWrap();

        this._onSocketErrorBind = this._onSocketError.bind(this);
        this._onSocketCloseBind = this._onSocketClose.bind(this);
        this._onSocketPacketBind = this._onSocketPacket.bind(this);
    }

    protected _onSocketError(err: any) {
        let msg = `[IPCBus:Node] server error ${err}`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
        this._reset();
    }

    protected _onSocketClose() {
        let msg = `[IPCBus:Node] server close`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(msg);
        this._reset();
    }

    protected _onSocketPacket(packet: IpcPacketBuffer) {
        let args = packet.parseArray();
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

    private _reset() {
        this._promiseConnected = null;
        this._socketWriter = null;
        if (this._baseIpc) {
            this._baseIpc.removeListener('packet', this._onSocketPacketBind);
            this._baseIpc.socket.removeListener('error', this._onSocketErrorBind);
            this._baseIpc.socket.removeListener('close', this._onSocketCloseBind);
            this._baseIpc.socket.end();
            this._baseIpc = null;
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

                let baseIpc = new BaseIpc();
                let timer: NodeJS.Timer = null;
                let fctReject = (msg: string) => {
                    if (timer) {
                        clearTimeout(timer);
                    }
                    baseIpc.socket.removeAllListeners();
                    this._reset();
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                    reject(msg);
                };
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

                let catchOpen = (conn: any) => {
                    clearTimeout(timer);
                    baseIpc.socket.removeAllListeners();

                    this._baseIpc = baseIpc;

                    this._baseIpc.addListener('packet', this._onSocketPacketBind);
                    this._baseIpc.socket.addListener('error', this._onSocketErrorBind);
                    this._baseIpc.socket.addListener('close', this._onSocketCloseBind);

                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Node] connected on ${JSON.stringify(this._ipcOptions)}`);
                    if ((this._socketBuffer == null) || (this._socketBuffer === 0)) {
                        this._socketWriter = new SocketWriter(this._baseIpc.socket);
                    }
                    else if (this._socketBuffer < 0) {
                        this._socketWriter = new DelayedSocketWriter(this._baseIpc.socket);
                    }
                    else if (this._socketBuffer > 0) {
                        this._socketWriter = new BufferedSocketWriter(this._baseIpc.socket, this._socketBuffer);
                    }
                    this.ipcPushCommand(IpcBusCommand.Kind.Connect, '');
                    resolve();
                };

                baseIpc.connect(this._ipcOptions.port, this._ipcOptions.host);
                baseIpc.socket.addListener('connect', catchOpen);
                baseIpc.socket.addListener('error', catchError);
                baseIpc.socket.addListener('close', catchClose);
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
            if (this._baseIpc) {
                this.ipcPushCommand(IpcBusCommand.Kind.Close, '');
                let timer: NodeJS.Timer;
                let baseIpc = this._baseIpc;

                let catchClose = () => {
                    clearTimeout(timer);
                    baseIpc.socket.removeListener('close', catchClose);
                    resolve();
                };
                // Below zero = infinite
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        baseIpc.socket.removeListener('close', catchClose);

                        let msg = `[IPCBus:Node] stop, error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(this._ipcOptions)}`;
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                        reject(msg);
                    }, options.timeoutDelay);
                }
                this._baseIpc.socket.addListener('close', catchClose);
                this._baseIpc.socket.destroy();
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
        if (this._socketWriter) {
            if (args) {
                this._packet.writeArray(this._socketWriter, [ipcBusCommand, ...args]);
            }
            else {
                this._packet.writeArray(this._socketWriter, [ipcBusCommand]);
            }
        }
    }
}
