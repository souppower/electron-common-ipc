/// <reference types='electron' />

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import {
    IPCBUS_TRANSPORT_RENDERER_HANDSHAKE,
    IPCBUS_TRANSPORT_RENDERER_COMMAND,
    IPCBUS_TRANSPORT_RENDERER_EVENT
} from '../renderer/IpcBusConnectorRenderer';
import { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusRendererBridge implements IpcBusConnector.Client {
    private _ipcMain: Electron.IpcMain;
    protected _subscriptions: IpcBusUtils.ChannelConnectionMap<Electron.WebContents>;
    protected _bridge: IpcBusBridgeImpl;
    // private _packetDecoder: IpcPacketBuffer;

    constructor(bridge: IpcBusBridgeImpl) {
        this._bridge = bridge;

        this._ipcMain = require('electron').ipcMain;
        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<Electron.WebContents>('IPCBus:RendererBridge', true);
        this._subscriptions.on('channel-added', (channel) => {
            this._bridge._onRendererAddChannels([channel]);
        });
        this._subscriptions.on('channel-removed', (channel) => {
            this._bridge._onRendererRemoveChannels([channel]);
        });

        // callbacks
        this._onRendererCommandReceived = this._onRendererCommandReceived.bind(this);
    }

    hasChannel(channel: string): boolean {
        return this._subscriptions.hasChannel(channel);
    }

    hasRequestChannel(channel: string): boolean {
        return this._subscriptions.getRequestChannel(channel) != null;
    }

    connect(): Promise<void> {
        // To manage re-entrance
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onRendererCommandReceived);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onRendererCommandReceived);

        return Promise.resolve();
    }

    close(): Promise<void> {
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onRendererCommandReceived);
        return Promise.resolve();
    }

    // Not exposed
    queryState(): Object {
        const queryStateResult: Object[] = [];
        this._subscriptions.forEach((connData, channel) => {
            connData.peerRefCounts.forEach((peerRefCount) => {
                queryStateResult.push({ channel: channel, peer: peerRefCount.peer, count: peerRefCount.refCount });
            });
        });
        return queryStateResult;
    }

    // This is coming from the Electron Renderer Proces/s (Electron ipc)
    // =================================================================================================
    private _completePeerInfo(webContents: Electron.WebContents, peer: Client.IpcBusPeer): IpcBusConnector.Handshake {
        const handshake: IpcBusConnector.Handshake = {
            process: peer.process
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

    private _onRendererHandshake(webContents: Electron.WebContents, ipcBusCommand: IpcBusCommand): void {
        const ipcBusPeer = ipcBusCommand.peer;
        const handshake = this._completePeerInfo(webContents, ipcBusPeer);

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

    onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void {
        const rawContent = ipcPacketBuffer.getRawContent();
        this._onCommandSendMessage(null, ipcBusCommand, rawContent);
    }

    onConnectorBufferReceived(__ignore__: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): void {
        this._onCommandSendMessage(null, ipcBusCommand, rawContent);
    }

    onConnectorClosed(): void {
    }

    private _onCommandSendMessage(webContents: Electron.WebContents | null, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
                if (ipcBusCommand.request && webContents) {
                    this._subscriptions.setRequestChannel(ipcBusCommand.request.replyChannel, webContents, ipcBusCommand.peer);
                }
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
                    connData.conn.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, rawContent);
                });
                break;
            }

            case IpcBusCommand.Kind.RequestResponse: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
                const connData = this._subscriptions.getRequestChannel(ipcBusCommand.request.replyChannel);
                if (connData) {
                    this._subscriptions.deleteRequestChannel(ipcBusCommand.request.replyChannel);
                    connData.conn.send(IPCBUS_TRANSPORT_RENDERER_EVENT, ipcBusCommand, rawContent);
                }
                break;
            }

            case IpcBusCommand.Kind.RequestClose:
                this._subscriptions.deleteRequestChannel(ipcBusCommand.request.replyChannel);
                break;
        }
    }

    _onRendererCommandReceived(event: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        const webContents: Electron.WebContents = event.sender;
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.Handshake:
                this._onRendererHandshake(webContents, ipcBusCommand);
                break;

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
                this._onCommandSendMessage(webContents, ipcBusCommand, rawContent);
                this._bridge._onRendererMessagedReceived(webContents, ipcBusCommand, rawContent);
                break;
        }
    }
}

