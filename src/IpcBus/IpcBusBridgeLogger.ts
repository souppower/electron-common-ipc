import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export abstract class IpcBusBridgeLogger extends IpcBusBridgeImpl {
    constructor(processType: IpcBusInterfaces.IpcBusProcessType, options: IpcBusInterfaces.IpcBusBridge.CreateOptions) {
        super(processType, options);
    }

    protected abstract addLog(webContents: Electron.WebContents, ipcPacketBuffer: IpcPacketBuffer, ipcBusCommand: IpcBusCommand, args: any[]): void;

    protected _onEventReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage:
            case IpcBusCommand.Kind.RequestMessage: {
                let args = ipcPacketBuffer.parseArraySlice(1);
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
                    const webContents = connData.conn;
                    this.addLog(webContents, ipcPacketBuffer, ipcBusCommand, args);
                });
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                const webContents = this._requestChannels.get(ipcBusCommand.request.replyChannel);
                if (webContents) {
                    let args = ipcPacketBuffer.parseArraySlice(1);
                    this.addLog(webContents, ipcPacketBuffer, ipcBusCommand, args);
                }
                break;
            }
        }
        super._onEventReceived(ipcBusCommand, ipcPacketBuffer);
    }

    protected _onRendererMessage(event: any, ipcBusCommand: IpcBusCommand, buffer: Buffer) {
        this._packetIn.decodeFromBuffer(buffer);
        let args = this._packetIn.parseArraySlice(1);
        this.addLog(event.sender, this._packetIn, ipcBusCommand, args);
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(log);

        super._onRendererMessage(event, ipcBusCommand, buffer);
    }
}

