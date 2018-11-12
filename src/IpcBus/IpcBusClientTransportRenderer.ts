import * as assert from 'assert';
import { EventEmitter } from 'events';

import { IpcPacketBuffer, IpcPacketBufferWrap, BufferListWriter } from 'socket-serializer';

import * as IpcBusUtils from './IpcBusUtils';
import * as Client from './IpcBusClient';

import { IpcBusClientTransport } from './IpcBusClientTransport';
import { IpcBusCommand } from './IpcBusCommand';

export const IPCBUS_TRANSPORT_RENDERER_CONNECT = 'IpcBusRenderer:Connect';
export const IPCBUS_TRANSPORT_RENDERER_COMMAND = 'IpcBusRenderer:Command';
export const IPCBUS_TRANSPORT_RENDERER_EVENT = 'IpcBusRenderer:Event';

export interface IpcBusTransportInWindow extends EventEmitter {
    send(channel: string, ...args: any[]): void;
}

// Implementation for renderer process
/** @internal */
export class IpcBusClientTransportRenderer extends IpcBusClientTransport {
    private _ipcTransportInWindow: IpcBusTransportInWindow;
    private _onIpcEventReceived: Function;
    private _promiseConnected: Promise<void>;
    private _packetOut: IpcPacketBufferWrap;
    private _packetIn: IpcPacketBuffer;
    private _connected: boolean;

    // private _ipcRendererReady: Promise<void>;

    constructor(processType: Client.IpcBusProcessType, options: Client.IpcBusClient.CreateOptions, ipcTransportInWindow: IpcBusTransportInWindow) {
        assert(processType === 'renderer', `IpcBusClientTransportRenderer: processType must not be a process ${processType}`);
        super({ type: processType, pid: -1 }, options);

        this._ipcTransportInWindow = ipcTransportInWindow;

        this._packetOut = new IpcPacketBufferWrap();
        this._packetIn = new IpcPacketBuffer();
    }

    protected _reset() {
        this._promiseConnected = null;
        if (this._connected) {
            this._ipcTransportInWindow.removeAllListeners(IPCBUS_TRANSPORT_RENDERER_CONNECT);
            this._ipcTransportInWindow.removeAllListeners(IPCBUS_TRANSPORT_RENDERER_EVENT);
            this._connected = false;
        }
    }

    private _onConnect(eventOrPeer: any, peerOrUndefined: Client.IpcBusPeer): void {
        // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
        if (peerOrUndefined) {
            this._ipcBusPeer = peerOrUndefined;
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Standard listening for #${this._ipcBusPeer.name}`);
            this._onIpcEventReceived = (eventEmitter: any, ipcBusCommand: IpcBusCommand, buffer: Buffer) => {
                this._packetIn.decodeFromBuffer(buffer);
                this._onEventReceived(ipcBusCommand, this._packetIn);
            };
        } else {
            this._ipcBusPeer = eventOrPeer;
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Sandbox listening for #${this._ipcBusPeer.name}`);
            this._onIpcEventReceived = (ipcBusCommand: IpcBusCommand, buffer: Buffer) => {
                this._packetIn.decodeFromBuffer(buffer);
                this._onEventReceived(ipcBusCommand, this._packetIn);
            };
        }
        this._ipcTransportInWindow.addListener(IPCBUS_TRANSPORT_RENDERER_EVENT, this._onIpcEventReceived);
    };

    /// IpcBusTrandport API
    protected ipcConnect(options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        // Store in a local variable, in case it is set to null (paranoid code as it is asynchronous!)
        let p = this._promiseConnected;
        if (!p) {
            options = options || {};
            if (options.timeoutDelay == null) {
                options.timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
            }
            p = this._promiseConnected = new Promise<void>((resolve, reject) => {
                // this._ipcRendererReady.then(() => {
                    // Do not type timer as it may differ between node and browser api, let compiler and browserify deal with.
                    let timer: NodeJS.Timer;
                    // Below zero = infinite
                    if (options.timeoutDelay >= 0) {
                        timer = setTimeout(() => {
                            timer = null;
                            this._reset();
                            reject('timeout');
                        }, options.timeoutDelay);
                    }
                    // We wait for the bridge confirmation
                    this._connected = true;
                    this._ipcTransportInWindow.once(IPCBUS_TRANSPORT_RENDERER_CONNECT, (eventOrPeer: any, peerOrUndefined: Client.IpcBusPeer) => {
                        if (this._ipcTransportInWindow) {
                            clearTimeout(timer);
                            this._onConnect(eventOrPeer, peerOrUndefined);
                            resolve();
                        }
                        else {
                            this._reset();
                        }
                    });
                    this.ipcSend(IpcBusCommand.Kind.Connect, '', undefined, [options.peerName]);
                // });
            });
        }
        return p;
    }

    protected ipcClose(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        if (this._connected) {
            this.ipcSend(IpcBusCommand.Kind.Close, '');
            this._reset();
        }
        return Promise.resolve();
    }

    // We serialize in renderer process to save master CPU.
    // We keep ipcBusCommand in plain text, once again to have master handling it easily
    protected ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        if (this._connected) {
            let bufferWriter = new BufferListWriter();
            if (args) {
                this._packetOut.writeArray(bufferWriter, [ipcBusCommand, args]);
            }
            else {
                this._packetOut.writeArray(bufferWriter, [ipcBusCommand]);
            }
            this._ipcTransportInWindow.send(IPCBUS_TRANSPORT_RENDERER_COMMAND, ipcBusCommand, bufferWriter.buffer);
        }
    }
}

