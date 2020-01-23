import * as net from 'net';

import { IpcPacketBuffer, SocketWriter } from 'socket-serializer';

import * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';

import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';

/** @internal */
export class IpcBusBrokerNode extends IpcBusBrokerImpl {
    private _socketBridge: net.Socket;

    constructor(contextType: Client.IpcBusProcessType) {
        super(contextType);

        this._subscriptions.emitter = true;
        this._subscriptions.on('channel-added', (channel) => {
            this._socketBridge && this.bridgeAddChannel(channel);
        });
        this._subscriptions.on('channel-removed', (channel) => {
            this._socketBridge && this.bridgeRemoveChannel(channel);
        });
    }

    protected _reset(closeServer: boolean) {
        super._reset(closeServer);
        this._socketBridge = null;
    }

    protected bridgeConnect(socket: net.Socket) {
        this._socketBridge = socket;
        // this._bridgeChannels.clear();
        const channels = this._subscriptions.getChannels();
        for (let i = 0, l = channels.length; i < l; ++i) {
            this.bridgeAddChannel(channels[i]);
        }
    }

    protected bridgeClose() {
        this._socketBridge = null;
        // this._bridgeChannels.clear();
        // const channels = this._subscriptions.getChannels();
        // for (let i = 0, l = channels.length; i < l; ++i) {
        //     this.brokerRemoveChannel();
        // }
    }

    protected bridgeAddChannel(channel: string) {
        const ipcBusCommand: IpcBusCommand = {
            kind: IpcBusCommand.Kind.AddChannelListener,
            channel,
            peer: this._ipcBusBrokerClient.peer
        };
        const socketWriter = new SocketWriter(this._socketBridge);
        const ipcPacketBuffer = new IpcPacketBuffer();
        ipcPacketBuffer.writeArray(socketWriter, [ipcBusCommand]);
    }

    protected bridgeRemoveChannel(channel: string) {
        const ipcBusCommand: IpcBusCommand = {
            kind: IpcBusCommand.Kind.RemoveChannelListener,
            channel,
            peer: this._ipcBusBrokerClient.peer
        };
        const socketWriter = new SocketWriter(this._socketBridge);
        const ipcPacketBuffer = new IpcPacketBuffer();
        ipcPacketBuffer.writeArray(socketWriter, [ipcBusCommand]);
    }

    protected bridgeBroadcastMessage(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        this._socketBridge && this._socketBridge.write(ipcPacketBuffer.buffer);
    }
}
