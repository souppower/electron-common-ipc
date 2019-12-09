import * as Client from '../IpcBusClient';
import { extractPeerIdFromReplyChannel } from '../IpcBusTransportImpl';

import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export abstract class IpcBusBridgeLogger extends IpcBusBridgeImpl {
    constructor(contextType: Client.IpcBusProcessType) {
        super(contextType);
    }

    protected abstract addLog(webContents: Electron.WebContents, peer: Client.IpcBusPeer, ipcBusCommand: IpcBusCommand, args: any[]): void;

    protected _onCommandSendMessage(ipcBusCommand: IpcBusCommand, args: any[]) {
        this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
            const webContents = connData.conn.constructor.name === 'WebContents' ? connData.conn as Electron.WebContents : undefined;
            connData.peerIds.forEach((peerId) => {
                const peer = this._ipcBusPeers.get(peerId.peerId);
                this.addLog(webContents, peer, ipcBusCommand, args);
            });
        });
        super._onCommandSendMessage(ipcBusCommand, args);
    }

    protected _onCommandRequestMessage(ipcBusCommand: IpcBusCommand, args: any[]) {
        this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
            const webContents = connData.conn.constructor.name === 'WebContents' ? connData.conn as Electron.WebContents : undefined;
            connData.peerIds.forEach((peerId) => {
                const peer = this._ipcBusPeers.get(peerId.peerId);
                this.addLog(webContents, peer, ipcBusCommand, args);
            });
        });
        super._onCommandRequestMessage(ipcBusCommand, args);
    }

    protected _onCommandRequestResponse(ipcBusCommand: IpcBusCommand, args: any[]) {
        const ipcBusSender = this._subscriptions.getRequestChannel(ipcBusCommand.request.replyChannel);
        if (ipcBusSender) {
            const peerId = extractPeerIdFromReplyChannel(ipcBusCommand.request.replyChannel);
            const peer = this._ipcBusPeers.get(peerId);
            const webContents = ipcBusSender.constructor.name === 'WebContents' ? ipcBusSender as Electron.WebContents : undefined;
            this.addLog(webContents, peer, ipcBusCommand, args);
        }
        super._onCommandRequestResponse(ipcBusCommand, args);
    }

    _onRendererMessage(event: any, ipcBusCommand: IpcBusCommand, args: any[]) {
        this.addLog(event.sender, ipcBusCommand.peer, ipcBusCommand, args);
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(log);
        super._onRendererMessage(event, ipcBusCommand, args);
    }
}

