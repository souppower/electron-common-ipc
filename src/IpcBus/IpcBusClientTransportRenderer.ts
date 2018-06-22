/// <reference types='electron' />

import * as assert from 'assert';

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusClientTransport } from './IpcBusClientTransport';
import { IpcBusCommand } from './IpcBusCommand';
import { BufferListWriter } from 'socket-serializer/lib/socket-serializer';

export const IPCBUS_TRANSPORT_RENDERER_CONNECT = 'IpcBusRenderer:Connect';
export const IPCBUS_TRANSPORT_RENDERER_COMMAND = 'IpcBusRenderer:Command';
export const IPCBUS_TRANSPORT_RENDERER_EVENT = 'IpcBusRenderer:Event';

// Implementation for renderer process
/** @internal */
export class IpcBusClientTransportRenderer extends IpcBusClientTransport {
    private _ipcRenderer: any;
    private _onIpcEventReceived: Function;
    private _promiseConnected: Promise<void>;
    private _packetBuffer: IpcPacketBuffer;

    // private _ipcRendererReady: Promise<void>;

    constructor(processType: IpcBusInterfaces.IpcBusProcessType, options: IpcBusInterfaces.IpcBusClient.CreateOptions) {
        assert(processType === 'renderer', `IpcBusClientTransportRenderer: processType must not be a process ${processType}`);
        super({ type: processType, pid: -1 }, options);
        this._packetBuffer = new IpcPacketBuffer();
    }

    protected _reset() {
        this._promiseConnected = null;
        if (this._ipcRenderer) {
            this._ipcRenderer.removeAllListeners(IPCBUS_TRANSPORT_RENDERER_CONNECT);
            this._ipcRenderer.removeAllListeners(IPCBUS_TRANSPORT_RENDERER_EVENT);
            this._ipcRenderer = null;
        }
    }

    private _onConnect(eventOrPeer: any, peerOrUndefined: IpcBusInterfaces.IpcBusPeer): void {
        // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
        if (peerOrUndefined) {
            this._ipcBusPeer = peerOrUndefined;
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Standard listening for #${this._ipcBusPeer.name}`);
            this._onIpcEventReceived = (eventEmitter: any, ipcBusCommand: IpcBusCommand, buffer: Buffer) => {
                this._packetBuffer.decodeFromBuffer(buffer);
                this._onEventReceived(this._packetBuffer);
            };
        } else {
            this._ipcBusPeer = eventOrPeer;
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Sandbox listening for #${this._ipcBusPeer.name}`);
            this._onIpcEventReceived = (ipcBusCommand: IpcBusCommand, buffer: Buffer) => {
                this._packetBuffer.decodeFromBuffer(buffer);
                this._onEventReceived(this._packetBuffer);
            };
        }
        this._ipcRenderer.addListener(IPCBUS_TRANSPORT_RENDERER_EVENT, this._onIpcEventReceived);
    };

    /// IpcBusTrandport API
    protected ipcConnect(options?: IpcBusInterfaces.IpcBusClient.ConnectOptions): Promise<void> {
        // Store in a local variable, in case it is set to null (paranoid code as it is asynchronous!)
        let p = this._promiseConnected;
        if (!p) {
            options = options || {};
            if (options.timeoutDelay == null) {
                options.timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
            }
            p = this._promiseConnected = new Promise<void>((resolve, reject) => {
                // this._ipcRendererReady.then(() => {
                    this._ipcRenderer = require('electron').ipcRenderer;
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
                    this._ipcRenderer.once(IPCBUS_TRANSPORT_RENDERER_CONNECT, (eventOrPeer: any, peerOrUndefined: IpcBusInterfaces.IpcBusPeer) => {
                        if (this._ipcRenderer) {
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

    protected ipcClose(options?: IpcBusInterfaces.IpcBusClient.CloseOptions): Promise<void> {
        if (this._ipcRenderer) {
            this.ipcSend(IpcBusCommand.Kind.Close, '');
            this._reset();
        }
        return Promise.resolve();
    }

    // We serialize in renderer process to save master CPU.
    // We keep ipcBusCommand in plain text, once again to have master handling it easily
    protected ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        if (this._ipcRenderer) {
            let bufferWriter = new BufferListWriter();
            if (args) {
                this._packetBuffer.writeArray(bufferWriter, [ipcBusCommand, ...args]);
            }
            else {
                this._packetBuffer.writeArray(bufferWriter, [ipcBusCommand]);
            }
            this._ipcRenderer.send(IPCBUS_TRANSPORT_RENDERER_COMMAND, ipcBusCommand, bufferWriter.buffer);
        }
    }
}

