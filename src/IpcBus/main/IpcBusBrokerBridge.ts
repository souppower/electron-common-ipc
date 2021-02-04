import type * as net from 'net';

import type { IpcPacketBuffer, IpcPacketBufferCore, IpcPacketBufferList } from 'socket-serializer';

import type * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusBrokerImpl, WriteBuffersToSocket } from '../node/IpcBusBrokerImpl';

import type { IpcBusBridgeImpl, IpcBusBridgeClient } from './IpcBusBridgeImpl';

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

    getChannels(): string[] {
        return this._subscriptions.getChannels();
    }

    broadcastConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return super.connect(options).then(() => {});
    }

    broadcastClose(options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return super.close(options).then(() => {});
    }

    broadcastArgs(ipcBusCommand: IpcBusCommand, args: any[]): void {
        // if (this.hasChannel(ipcBusCommand.channel)) {
        //     ipcBusCommand.bridge = true;
        //     this._packet.serialize([ipcBusCommand, args]);
        //     this.broadcastBuffer(ipcBusCommand, this._packet.buffer);
        // }
    }

    broadcastRawData(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawData): void {
        if (rawContent.buffer) {
            this.broadcastBuffers(ipcBusCommand, [rawContent.buffer]);
        }
        else {
            this.broadcastBuffers(ipcBusCommand, rawContent.buffers);
        }
    }

    broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): void {
        this.broadcastBuffers(ipcBusCommand, ipcPacketBufferCore.buffers);
    }

    // Come from the main bridge: main or renderer
    broadcastBuffers(ipcBusCommand: IpcBusCommand, buffers: Buffer[]): void {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage:
                // this._subscriptions.pushResponseChannel have been done in the base class when getting socket
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData) => {
                    WriteBuffersToSocket(connData.conn, buffers);
                });
                break;

            case IpcBusCommand.Kind.RequestResponse: {
                const connData = this._subscriptions.popResponseChannel(ipcBusCommand.request.replyChannel);
                if (connData) {
                    WriteBuffersToSocket(connData.conn, buffers);
                }
                break;
            }

            case IpcBusCommand.Kind.RequestClose:
                break;
        }
    }

    protected _reset(closeServer: boolean) {
        super._reset(closeServer);
        this._bridge._onNetClosed();
    }

    protected broadcastToBridge(socket: net.Socket, ipcBusCommand: IpcBusCommand, ipcPacketBufferList: IpcPacketBufferList) {
        this._bridge._onNetMessageReceived(ipcBusCommand, ipcPacketBufferList);
    }

    protected broadcastToBridgeMessage(socket: net.Socket, ipcBusCommand: IpcBusCommand, ipcPacketBufferList: IpcPacketBufferList) {
        this._bridge._onNetMessageReceived(ipcBusCommand, ipcPacketBufferList);
    }
}
