/// <reference types='electron' />

// import * as semver from 'semver';
import type { IpcPacketBufferCore } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import type * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusRendererContent } from '../renderer/IpcBusRendererContent';
import type { IpcBusConnector } from '../IpcBusConnector';
import { ChannelConnectionMap } from '../IpcBusChannelMap';

import {
    IPCBUS_TRANSPORT_RENDERER_HANDSHAKE,
    IPCBUS_TRANSPORT_RENDERER_COMMAND,
    IPCBUS_TRANSPORT_RENDERER_EVENT
} from '../renderer/IpcBusConnectorRenderer';
import { CreateIpcBusLog } from '../log/IpcBusLog-factory';

import type { IpcBusBridgeImpl, IpcBusBridgeClient } from './IpcBusBridgeImpl';

interface WebContentsTarget {
    sender: Electron.WebContents;
    frameId: number;
}

function getKeyForTarget(webContentsTarget: WebContentsTarget) {
    return (webContentsTarget.sender.id << 8) + webContentsTarget.frameId;
}

// Even if electron is not use in a Node process
// Static import of electron crash the Node process (use require)
// import { webContents } from 'electron';
let electronModule: any;
try {
    electronModule = require('electron');
}
catch (err) {
}

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusRendererBridge implements IpcBusBridgeClient {
    private _bridge: IpcBusBridgeImpl;

    private _ipcMain: Electron.IpcMain;
    private _subscriptions: ChannelConnectionMap<Electron.WebContents, number>;

    private _rendererCallback: (...args: any[]) => void;

    constructor(bridge: IpcBusBridgeImpl) {
        this._bridge = bridge;

        this._ipcMain = require('electron').ipcMain;
        this._subscriptions = new ChannelConnectionMap<Electron.WebContents, number>('IPCBus:RendererBridge');

        this._subscriptions.client = {
            channelAdded: (channel) => {
                const ipcBusCommand: IpcBusCommand = {
                    peer: undefined,
                    kind: IpcBusCommand.Kind.AddChannelListener,
                    channel
                }
                this._bridge._onRendererChannelChanged(ipcBusCommand);
            },
            channelRemoved: (channel) => {
                const ipcBusCommand: IpcBusCommand = {
                    peer: undefined,
                    kind: IpcBusCommand.Kind.RemoveChannelListener,
                    channel
                }
                this._bridge._onRendererChannelChanged(ipcBusCommand);
            }
        };

        this._rendererCallback = this._onRendererRawContentReceived.bind(this);
        this._onRendererHandshake = this._onRendererHandshake.bind(this);
    }

    hasChannel(channel: string): boolean {
        return this._subscriptions.hasChannel(channel) || IpcBusUtils.IsWebContentsChannel(channel);
    }

    getChannels(): string[] {
        return this._subscriptions.getChannels();
    }

    broadcastConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        // To manage re-entrance
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._rendererCallback);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._rendererCallback);
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onRendererHandshake);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onRendererHandshake);

        return Promise.resolve();
    }

    broadcastClose(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onRendererHandshake);
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onRendererHandshake);
        return Promise.resolve();
    }

    // This is coming from the Electron Renderer Proces/s (Electron ipc)
    // =================================================================================================
    private _getHandshake(webContentsTarget: WebContentsTarget, peer: Client.IpcBusPeer): IpcBusConnector.Handshake {
        const logger = CreateIpcBusLog();
        const webContents = webContentsTarget.sender;

        // Inherit from the peer.process and then complete missing information
        const handshake: IpcBusConnector.Handshake = {
            process: peer.process,
            logLevel: logger.level,
        };
        handshake.process.wcid = webContents.id;
        handshake.process.frameid = webContentsTarget.frameId;
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

    private _trackRendererDestruction(webContents: Electron.WebContents): void {
        // When webContents is destroyed some properties like id are no more accessible !
        const webContentsId = webContents.id;
        webContents.addListener('destroyed', () => {
            // Have to remove this webContents, included its frames
            const webContentsTargets = this._subscriptions.getConns().filter((item) => {
                const webContentIdentifiers = IpcBusUtils.UnserializeWebContentsIdentifier(item.key);
                return (webContentIdentifiers.wcid === webContentsId);
            });
            for (let i = 0, l = webContentsTargets.length; i < l; ++i) {
                this._subscriptions.removeKey(webContentsTargets[i].key);
            }
        });
    }

    private _onRendererHandshake(event: Electron.IpcMainEvent, ipcBusPeer: Client.IpcBusPeer): void {
        const webContentsTarget = event as WebContentsTarget;
        const webContents = webContentsTarget.sender;

        this._trackRendererDestruction(webContents);

        const handshake = this._getHandshake(webContentsTarget, ipcBusPeer);
        // We get back to the webContents
        // - to confirm the connection
        // - to provide id/s
        // BEWARE, if the message is sent before webContents is ready, it will be lost !!!!
        if ((webContentsTarget.frameId !== IpcBusUtils.TopFrameId) || (webContents.getURL() && !webContents.isLoadingMainFrame())) {
            webContents.sendToFrame(webContentsTarget.frameId, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, ipcBusPeer, handshake);
        }
        else {
            webContents.on('did-finish-load', () => {
                webContents.sendToFrame(webContentsTarget.frameId, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, ipcBusPeer, handshake);
            });
        }
    }

    broadcastBuffers(ipcBusCommand: IpcBusCommand, buffers: Buffer[]): void {
        throw 'not implemented';
    }

    broadcastContent(ipcBusCommand: IpcBusCommand, rawContent: IpcBusRendererContent): void {
        throw 'not implemented';
    }

    // broadcastArgs(ipcBusCommand: IpcBusCommand, args: any[]): void {
    //     this._broadcastMessage(null, ipcBusCommand, args);
    // }

    // From main or net transport
    broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): void {
        const rawContent = ipcPacketBufferCore.getRawData() as IpcBusRendererContent;
        // IpcBusRendererContent.PackRawContent(rawContent);
        this._broadcastRawContent(null, ipcBusCommand, rawContent);
    }

    // From renderer transport
    private _broadcastRawContent(webContentsTarget: WebContentsTarget, ipcBusCommand: IpcBusCommand, rawContent: IpcBusRendererContent) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                const key = webContentsTarget ? getKeyForTarget(webContentsTarget) : 0;
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData) => {
                    // Prevent echo message
                    if (connData.key !== key) {
                        // const webContentIdentifiers = IpcBusUtils.UnserializeWebContentsIdentifier(connData.key);
                        connData.conn.sendToFrame((connData as any).frameid, IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, rawContent);
                    }
                });
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                const webContentsTargetIds = IpcBusUtils.GetWebContentsIdentifier(ipcBusCommand.request.replyChannel);
                if (webContentsTargetIds) {
                    const webContents = electronModule.webContents.fromId(webContentsTargetIds.wcid);
                    if (webContents) {
                        webContents.sendToFrame(webContentsTargetIds.frameid, IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, rawContent);
                    }
                }
                break;
            }

            case IpcBusCommand.Kind.RequestClose:
                break;
        }
    }

    private _onRendererRawContentReceived(event: Electron.IpcMainEvent, ipcBusCommand: IpcBusCommand, rawContent: IpcBusRendererContent) {
        const webContentsTarget = event as WebContentsTarget;
        const webContents = webContentsTarget.sender;
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.AddChannelListener: {
                const channnelConnectionRef = {
                    key: getKeyForTarget(webContentsTarget),
                    frameid: webContentsTarget.frameId,
                    conn: webContents
                };
                this._subscriptions.addRef(ipcBusCommand.channel, channnelConnectionRef, ipcBusCommand.peer);
                break;
            }

            case IpcBusCommand.Kind.RemoveChannelListener:
                this._subscriptions.release(ipcBusCommand.channel, getKeyForTarget(webContentsTarget), ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                this._subscriptions.releaseAll(ipcBusCommand.channel, getKeyForTarget(webContentsTarget), ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveListeners:
                this._subscriptions.removePeer(ipcBusCommand.peer);
                break;

            default:
                IpcBusRendererContent.FixRawContent(rawContent);

                // Start with renderer if we have to keep compressed buffer
                this._broadcastRawContent(webContentsTarget, ipcBusCommand, rawContent);

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

