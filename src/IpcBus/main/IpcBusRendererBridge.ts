/// <reference types='electron' />

// import * as semver from 'semver';
import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusRendererContent } from '../renderer/IpcBusRendererContent';
import { IpcBusConnector } from '../IpcBusConnector';

import {
    IPCBUS_TRANSPORT_RENDERER_HANDSHAKE,
    IPCBUS_TRANSPORT_RENDERER_COMMAND,
    IPCBUS_TRANSPORT_RENDERER_EVENT
} from '../renderer/IpcBusConnectorRenderer';
import { CreateIpcBusLog } from '../log/IpcBusLog-factory';

import { IpcBusBridgeImpl, IpcBusBridgeClient } from './IpcBusBridgeImpl';

// Seems to have a conflict between Electron.WebContents, WebContents, webContents.....
import { webContents as ElectronWebContents } from 'electron';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusRendererBridge implements IpcBusBridgeClient {
    private _bridge: IpcBusBridgeImpl;

    private _ipcMain: Electron.IpcMain;
    private _subscriptions: IpcBusUtils.ChannelConnectionMap<Electron.WebContents, number>;
    // private _noSerialization: boolean;

    private _rendererCallback: (...args: any[]) => void;

    constructor(bridge: IpcBusBridgeImpl) {
        this._bridge = bridge;

        this._ipcMain = require('electron').ipcMain;
        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<Electron.WebContents, number>(
            'IPCBus:RendererBridge',
            (conn) => conn.id,
            false
        );

//        this._noSerialization = semver.gte(process.versions.electron, '8.0.0');
        // this._noSerialization = false;

        // callbacks
        // if (this._noSerialization) {
        //     this._rendererCallback = this._onRendererArgsReceived.bind(this);
        // }
        // else {
            this._rendererCallback = this._onRendererRawContentReceived.bind(this);
        // }
        this._onRendererHandshake = this._onRendererHandshake.bind(this);
    }

    hasChannel(channel: string): boolean {
        return this._subscriptions.hasChannel(channel) || IpcBusUtils.IsWebContentsChannel(channel);
    }

    connect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        // To manage re-entrance
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._rendererCallback);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._rendererCallback);
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onRendererHandshake);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onRendererHandshake);

        return Promise.resolve();
    }

    close(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onRendererHandshake);
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onRendererHandshake);
        return Promise.resolve();
    }

    // // Not exposed
    // queryState(): Object {
    //     const queryStateResult: Object[] = [];
    //     this._subscriptions.forEach((connData, channel) => {
    //         connData.peerRefCounts.forEach((peerRefCount) => {
    //             queryStateResult.push({ channel: channel, peer: peerRefCount.peer, count: peerRefCount.refCount });
    //         });
    //     });
    //     return queryStateResult;
    // }

    // This is coming from the Electron Renderer Proces/s (Electron ipc)
    // =================================================================================================
    private _getHandshake(webContents: Electron.WebContents, peer: Client.IpcBusPeer): IpcBusConnector.Handshake {
        const logger = CreateIpcBusLog();

        // Inherit from the peer.process and then complete missing information
        const handshake: IpcBusConnector.Handshake = {
            process: peer.process,
            logLevel: logger.level,
            // noSerialization: this._noSerialization
        };
        handshake.process.wcid = webContents.id;
        // Following functions are not implemented in all Electrons
        try {
            handshake.process.rid = webContents.getProcessId();
        }
        catch (err) {
            handshake.process.rid = -1;
        }
        try {
            handshake.process.pid = webContents.getOSProcessId();
        }
        catch (err) {
            // For backward we fill pid with webContents id
            handshake.process.pid = webContents.id;
        }
        return handshake;
    }

    private _onRendererHandshake(event: Electron.IpcMainEvent, ipcBusPeer: Client.IpcBusPeer): void {
        const webContents = event.sender;
        const handshake = this._getHandshake(webContents, ipcBusPeer);

        // if we have several clients within the same webcontents, the callback may be called several times !
        webContents.addListener('destroyed', () => {
            this._subscriptions.removeConnection(webContents);
        });
        // We get back to the webContents
        // - to confirm the connection
        // - to provide id/s
        // BEWARE, if the message is sent before webContents is ready, it will be lost !!!!
        if (webContents.getURL() && !webContents.isLoadingMainFrame()) {
            webContents.send(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, ipcBusPeer, handshake);
        }
        else {
            webContents.on('did-finish-load', () => {
                webContents.send(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, ipcBusPeer, handshake);
            });
        }
    }

    broadcastBuffer(ipcBusCommand: IpcBusCommand, buffer: Buffer): void {
        throw 'not implemented';
    }

    broadcastContent(ipcBusCommand: IpcBusCommand, rawContent: IpcBusRendererContent): void {
        throw 'not implemented';
    }
    
    // broadcastArgs(ipcBusCommand: IpcBusCommand, args: any[]): void {
    //     this._broadcastMessage(null, ipcBusCommand, args);
    // }

    // From main or net transport
    broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void {
        const rawContent = ipcPacketBuffer.getRawContent() as IpcBusRendererContent;
        // IpcBusRendererContent.PackRawContent(rawContent);
        this._broadcastRawContent(null, ipcBusCommand, rawContent);
    }

    // From renderer transport
    private _broadcastRawContent(webContents: Electron.WebContents | null, ipcBusCommand: IpcBusCommand, rawContent: IpcBusRendererContent) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                // Prevent echo message
                const sourceKey = webContents ? this._subscriptions.getKey(webContents) : undefined;
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData) => {
                    if (connData.key !== sourceKey) {
                        connData.conn.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, rawContent);
                    }
                });
                break;
            }

            case IpcBusCommand.Kind.RequestResponse: {
                const webContentsId = IpcBusUtils.GetWebContentsChannel(ipcBusCommand.request.replyChannel);
                if (webContentsId) {
                    const webContentsTarget = ElectronWebContents.fromId(webContentsId);
                    if (webContentsTarget) {
                        webContentsTarget.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, rawContent);
                    }
                }
                break;
            }

            case IpcBusCommand.Kind.RequestClose:
                break;
        }
    }

    private _onRendererRawContentReceived(event: Electron.IpcMainEvent, ipcBusCommand: IpcBusCommand, rawContent: IpcBusRendererContent) {
        const webContents = event.sender;
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.AddChannelListener:
                this._subscriptions.addRef(ipcBusCommand.channel, webContents, ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveChannelListener:
                this._subscriptions.release(ipcBusCommand.channel, webContents, ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                this._subscriptions.releaseAll(ipcBusCommand.channel, webContents, ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveListeners:
                this._subscriptions.removePeer(webContents, ipcBusCommand.peer);
                break;

            default:
                IpcBusRendererContent.FixRawContent(rawContent);

                // Start with renderer if we have to keep compressed buffer
                this._broadcastRawContent(webContents, ipcBusCommand, rawContent);

                // IpcBusRendererContent.UnpackRawContent(rawContent);
                this._bridge._onRendererContentReceived(ipcBusCommand, rawContent);
                break;
        }
    }

    // private _onRendererArgsReceived(event: any, ipcBusCommand: IpcBusCommand, args: any[]) {
    //     const webContents: Electron.WebContents = event.sender;
    //     if (this._onRendererAdmindReceived(webContents, ipcBusCommand) === false) {
    //         this._broadcastMessage(webContents, ipcBusCommand, args);
    //         this._bridge._onRendererArgsReceived(ipcBusCommand, args);
    //     }
    // }
}

