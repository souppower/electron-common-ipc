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
    protected _busConn: any;
    private _promiseConnected: Promise<string>;

    private _socketBuffer: number;
    private _socketWriter: Writer;
    private _packet: IpcPacketBufferWrap;

    constructor(processType: IpcBusInterfaces.IpcBusProcessType, ipcOptions: IpcBusUtils.IpcOptions) {
        super({ type: processType, pid: process.pid }, ipcOptions);
        this._packet = new IpcPacketBufferWrap();
        assert((processType === 'browser') || (processType === 'node'), `IpcBusTransportNode: processType must not be a process ${processType}`);
    }

    protected _onClose() {
        this._reset();
    }

    private _reset() {
        this._promiseConnected = null;
        if (this._busConn) {
            this._busConn.end();
            this._busConn = null;
        }
        if (this._baseIpc) {
            this._baseIpc.removeAllListeners();
            this._baseIpc = null;
        }
    }

    /// IpcBusTransport API
    ipcConnect(options: IpcBusInterfaces.IpcBusClient.ConnectOptions): Promise<string> {
        // Store in a local variable, in case it is set to null (paranoid code as it is asynchronous!)
        let p = this._promiseConnected;
        if (!p) {
            p = this._promiseConnected = new Promise<string>((resolve, reject) => {
                this._ipcBusPeer.name = options.peerName || `${this._ipcBusPeer.process.type}_${this._ipcBusPeer.process.pid}`;
                this._socketBuffer = options.socketBuffer;
                let timer: NodeJS.Timer;
                // Below zero = infinite
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        this._reset();
                        let msg = `[IPCBus:Node] error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(this._ipcOptions)}`;
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                        reject(msg);
                    }, options.timeoutDelay);
                }
                this._baseIpc = new BaseIpc();
                this._baseIpc.on('connect', (conn: any) => {
                    this._busConn = conn;
                    if (this._baseIpc) {
                        this._baseIpc.removeAllListeners('error');
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Node] connected on ${JSON.stringify(this._ipcOptions)}`);
                        clearTimeout(timer);
                        if ((this._socketBuffer == null) || (this._socketBuffer === 0)) {
                            this._socketWriter = new SocketWriter(this._busConn);
                        }
                        else if (this._socketBuffer < 0) {
                            this._socketWriter = new DelayedSocketWriter(this._busConn);
                        }
                        else if (this._socketBuffer > 0) {
                            this._socketWriter = new BufferedSocketWriter(this._busConn, this._socketBuffer);
                        }
                        this.ipcPushCommand(IpcBusCommand.Kind.Connect, '');
                        resolve('connected');
                    }
                    else {
                        this._reset();
                    }
                });
                this._baseIpc.on('packet', (packet: IpcPacketBuffer) => {
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
                });
                this._baseIpc.once('error', (err: any) => {
                    let msg = `[IPCBus:Node] error = ${err} on ${JSON.stringify(this._ipcOptions)}`;
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                    clearTimeout(timer);
                    this._reset();
                    reject(msg);
                });
                this._baseIpc.on('close', (conn: any) => {
                    let msg = `[IPCBus:Node] server close`;
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(msg);
                    this._onClose();
                    reject(msg);
                });
                this._baseIpc.connect(this._ipcOptions.port, this._ipcOptions.host);
            });
        }
        return p;
    }

    ipcClose(options?: IpcBusInterfaces.IpcBusClient.CloseOptions): Promise<void> {
        this.ipcPushCommand(IpcBusCommand.Kind.Close, '');
        return new Promise<void>((resolve, reject) => {
            if (this._baseIpc) {
                let timer: NodeJS.Timer;
                // Below zero = infinite
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        let msg = `[IPCBus:Node] stop, error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(this._ipcOptions)}`;
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                        reject(msg);
                    }, options.timeoutDelay);
                }
                this._baseIpc.on('close', (conn: any) => {
                    clearTimeout(timer);
                    resolve();
                });
                this._baseIpc.on('error', (conn: any) => {
                    clearTimeout(timer);
                    resolve();
                });
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
        if (this._busConn) {
            if (args) {
                this._packet.writeArray(this._socketWriter, [ipcBusCommand, ...args]);
            }
            else {
                this._packet.writeArray(this._socketWriter, [ipcBusCommand]);
            }
        }
    }
}
