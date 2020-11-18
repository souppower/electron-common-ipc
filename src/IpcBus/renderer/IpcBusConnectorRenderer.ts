import * as assert from 'assert';
import type { EventEmitter } from 'events';

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import type * as Client from '../IpcBusClient';
import type { IpcBusCommand } from '../IpcBusCommand';
import type { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusConnectorImpl } from '../IpcBusConnectorImpl';

import { IpcBusRendererContent } from './IpcBusRendererContent';

export const IPCBUS_TRANSPORT_RENDERER_HANDSHAKE = 'ECIPC:IpcBusRenderer:Handshake';
export const IPCBUS_TRANSPORT_RENDERER_COMMAND = 'ECIPC:IpcBusRenderer:Command';
export const IPCBUS_TRANSPORT_RENDERER_EVENT = 'ECIPC:IpcBusRenderer:Event';

export interface IpcWindow extends EventEmitter {
    send(channel: string, ...args: any[]): void;
    sendTo(webContentsId: number, channel: string, ...args: any[]): void;
}

// Implementation for renderer process
/** @internal */
export class IpcBusConnectorRenderer extends IpcBusConnectorImpl {
    private _ipcWindow: IpcWindow;

    private _onIpcEventReceived: (...args: any[]) => void;
    // private _noSerialization: boolean;

    protected _connectCloseState: IpcBusUtils.ConnectCloseState<IpcBusConnector.Handshake>;

    constructor(contextType: Client.IpcBusProcessType, ipcWindow: IpcWindow) {
        assert(contextType === 'renderer' || contextType === 'renderer-frame', `IpcBusTransportWindow: contextType must not be a ${contextType}`);
        super(contextType);
        this._ipcWindow = ipcWindow;
        this._connectCloseState = new IpcBusUtils.ConnectCloseState<IpcBusConnector.Handshake>();
    }

    protected onConnectorShutdown() {
        if (this._onIpcEventReceived) {
            this._client.onConnectorShutdown();
            this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_EVENT, this._onIpcEventReceived);
            this._onIpcEventReceived = null;
        }
    }

    protected _onConnect(eventOrPeer: any, peerOrArgs: Client.IpcBusPeer | IpcBusConnector.Handshake, handshakeArg: IpcBusConnector.Handshake): IpcBusConnector.Handshake {
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport:Window] _onConnect`);
        // In sandbox mode, 1st parameter is no more the event, but directly arguments !!!
        if (handshakeArg) {
            // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport:Window] Sandbox off listening for #${this._messageId}`);
            const handshake = handshakeArg;
            // if (handshake.noSerialization) {
            //     this._onIpcEventReceived = (event, ipcBusCommand, args) => {
            //         this._client.onConnectorArgsReceived(ipcBusCommand, args);
            //     };
            // }
            // else {
                this._onIpcEventReceived = (event, ipcBusCommand, rawContent) => {
                    IpcBusRendererContent.FixRawContent(rawContent);
                    // IpcBusRendererContent.UnpackRawContent(rawContent);
                    this._client.onConnectorContentReceived(ipcBusCommand, rawContent);
                };
            // }
            this._ipcWindow.addListener(IPCBUS_TRANSPORT_RENDERER_EVENT, this._onIpcEventReceived);
            return handshake;
        }
        else {
            const handshake = peerOrArgs as IpcBusConnector.Handshake;
            // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport:Window] Sandbox on listening for #${this._messageId}`);
            // if (handshake.noSerialization) {
            //     this._onIpcEventReceived = (ipcBusCommand, args) => {
            //         this._client.onConnectorArgsReceived(ipcBusCommand, args);
            //     };
            // }
            // else {
                this._onIpcEventReceived = (ipcBusCommand, rawContent) => {
                    IpcBusRendererContent.FixRawContent(rawContent);
                    // IpcBusRendererContent.UnpackRawContent(rawContent);
                    this._client.onConnectorContentReceived(ipcBusCommand, rawContent);
                 };
            //  }
            this._ipcWindow.addListener(IPCBUS_TRANSPORT_RENDERER_EVENT, this._onIpcEventReceived);
            return handshake;
        }
    };

    /// IpcBusTrandport API
    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        return this._connectCloseState.connect(() => {
            return new Promise<IpcBusConnector.Handshake>((resolve, reject) => {
                // Do not type timer as it may differ between node and browser api, let compiler and browserify deal with.
                let timer: NodeJS.Timer;
                const onIpcConnect = (eventOrPeer: any, peerOrArgs: Client.IpcBusPeer | IpcBusConnector.Handshake, handshakeArg: IpcBusConnector.Handshake) => {
                    this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, onIpcConnect);
                    this.addClient(client);
                    const handshake = this._onConnect(eventOrPeer, peerOrArgs, handshakeArg);
                    // Keep the this._process ref intact as shared with client peers
                    this._process = Object.assign(this._process, handshake.process);
                    this._log.level = handshake.logLevel;
                    // this._noSerialization = handshake.noSerialization;
                    clearTimeout(timer);
                    resolve(handshake);
                };

                // Below zero = infinite
                options = IpcBusUtils.CheckConnectOptions(options);
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        timer = null;
                        this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, onIpcConnect);
                        reject('timeout');
                    }, options.timeoutDelay);
                }
                // We wait for the bridge confirmation
                this._ipcWindow.addListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, onIpcConnect);
                this._ipcWindow.send(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, client.peer);
            });
        });
    }

    shutdown(client: IpcBusConnector.Client, options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        return this._connectCloseState.close(() => {
            this.onConnectorShutdown();
            this.removeClient(client);
            return Promise.resolve();
        });
    }

    // We serialize in renderer process to save master CPU.
    // We keep ipcBusCommand in plain text, once again to have master handling it easily
    postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        // if (this._noSerialization) {
        //     this._ipcWindow.send(IPCBUS_TRANSPORT_RENDERER_COMMAND, ipcBusCommand, args);
        // }
        // else {
            const packetOut = new IpcPacketBuffer();
            packetOut.serializeArray([ipcBusCommand, args]);
            const rawContent = packetOut.getRawContent();
            // const packRawContent = IpcBusRendererContent.PackRawContentrawContent);
            const webContentsId = IpcBusUtils.GetWebContentsChannel(ipcBusCommand.channel);
            if (isNaN(webContentsId)) {
                this._ipcWindow.send(IPCBUS_TRANSPORT_RENDERER_COMMAND, ipcBusCommand, rawContent);
            }
            else {
                this._ipcWindow.sendTo(webContentsId, IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, rawContent);
            }
        // }
    }

    postBuffer(buffer: Buffer) {
        throw 'not implemented';
    }
}
