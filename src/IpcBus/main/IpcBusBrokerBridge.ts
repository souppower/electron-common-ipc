import { IpcPacketBuffer } from 'socket-serializer';

import * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusBrokerImpl } from '../node/IpcBusBrokerImpl';

import { IpcBusBridgeImpl, IpcBusBridgeClient } from './IpcBusBridgeImpl';

/** @internal */
export class IpcBusBrokerBridge extends IpcBusBrokerImpl implements IpcBusBridgeClient {
    private _bridge: IpcBusBridgeImpl;

    constructor(contextType: Client.IpcBusProcessType, bridge: IpcBusBridgeImpl) {
        super(contextType);

        this._bridge = bridge;
    }

    hasChannel(channel: string) {
        return this._subscriptions.hasChannel(channel);
    }

    connect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return super.connect(options)
    }

    close(options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return super.close(options);
    }

    // broadcastArgs(ipcBusCommand: IpcBusCommand, args: any[]): void {
    //     if (this.hasChannel(ipcBusCommand.channel)) {
    //         ipcBusCommand.bridge = true;
    //         this._packet.serializeArray([ipcBusCommand, args]);
    //         this.broadcastBuffer(ipcBusCommand, this._packet.buffer);
    //     }
    // }

    broadcastContent(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): void {
        this.broadcastBuffer(ipcBusCommand, rawContent.buffer);
    }

    broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void {
        this.broadcastBuffer(ipcBusCommand, ipcPacketBuffer.buffer);
    }

    broadcastBuffer(ipcBusCommand: IpcBusCommand, buffer: Buffer): void {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage:
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData) => {
                    connData.conn.write(buffer);
                });
                break;

            case IpcBusCommand.Kind.RequestResponse: {
                const connData = this._subscriptions.popResponseChannel(ipcBusCommand.request.replyChannel);
                if (connData) {
                    connData.conn.write(buffer);
                }
                break;
            }

            case IpcBusCommand.Kind.RequestClose:
                if (this._subscriptions.popResponseChannel(ipcBusCommand.request.replyChannel)) {
                    // log IpcBusLog.Kind.GET_CLOSE_REQUEST
                }
                break;
        }
    }

    protected _reset(closeServer: boolean) {
        super._reset(closeServer);
        this._bridge._onNetClosed();
    }

    protected bridgeBroadcastMessage(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        this._bridge._onNetMessageReceived(ipcBusCommand, ipcPacketBuffer);
    }
}
