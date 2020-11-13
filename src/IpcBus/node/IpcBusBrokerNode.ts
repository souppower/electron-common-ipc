import * as net from 'net';

import { IpcPacketBuffer, SocketWriter } from 'socket-serializer';

import * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { CreateUniqId } from '../IpcBusUtils';

import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';
import { IpcBusBrokerSocket, IpcBusBrokerSocketClient } from './IpcBusBrokerSocket';

/** @internal */
export class IpcBusBrokerNode extends IpcBusBrokerImpl {
    private _socketBridge: IpcBusBrokerSocket;
    // private _socketBridge: net.Socket;
    private _peer: Client.IpcBusPeer;

    constructor(contextType: Client.IpcBusProcessType) {
        super(contextType);

        this._peer = { 
            id: `${contextType}.${CreateUniqId()}`,
            process: {
                type: contextType,
                pid: process ? process.pid: -1
            },
            name: ''
        }

        this._subscriptions.emitter = true;
        this._subscriptions.on('channel-added', (channel) => {
            this._socketBridge && this.bridgeAddChannel(channel);
        });
        this._subscriptions.on('channel-removed', (channel) => {
            this._socketBridge && this.bridgeRemoveChannel(channel);
        });
    }

    protected _reset(closeServer: boolean) {
        if (this._socketBridge) {
            // this._socketBridge.release();
            this._socketBridge = null;
        }
        super._reset(closeServer);
    }

    protected bridgeConnect(socket: net.Socket) {
        const client: IpcBusBrokerSocketClient = {
            onSocketPacket: (socket: net.Socket, ipcPacketBuffer: IpcPacketBuffer) => {
            },
            onSocketError : (socket: net.Socket, err: string) => {
                this._socketBridge = null;
            },
            onSocketClose: (socket: net.Socket) => {
                this._socketBridge = null;
            },
            onSocketEnd: (socket: net.Socket) => {
                this._socketBridge = null;
            },
        };

        this._socketBridge = new IpcBusBrokerSocket(socket, client);
        // this._socketBridge = socket;
        // this._bridgeChannels.clear();
        const channels = this._subscriptions.getChannels();
        for (let i = 0, l = channels.length; i < l; ++i) {
            this.bridgeAddChannel(channels[i]);
        }
    }

    protected bridgeClose() {
        if (this._socketBridge) {
            // this._socketBridge.release();
            this._socketBridge = null;
        }
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
            peer: this._peer
        };
        const socketWriter = new SocketWriter(this._socketBridge.socket);
        const ipcPacketBuffer = new IpcPacketBuffer();
        ipcPacketBuffer.writeArray(socketWriter, [ipcBusCommand]);
    }

    protected bridgeRemoveChannel(channel: string) {
        const ipcBusCommand: IpcBusCommand = {
            kind: IpcBusCommand.Kind.RemoveChannelListener,
            channel,
            peer: this._peer
        };
        const socketWriter = new SocketWriter(this._socketBridge.socket);
        const ipcPacketBuffer = new IpcPacketBuffer();
        ipcPacketBuffer.writeArray(socketWriter, [ipcBusCommand]);
    }

    protected bridgeBroadcastMessage(socket: net.Socket, ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        if (socket !== this._socketBridge.socket) {
            this._socketBridge.socket.write(ipcPacketBuffer.buffer);
        }
    }
}
