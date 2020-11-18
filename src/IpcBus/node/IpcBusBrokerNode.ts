import type * as net from 'net';

import { IpcPacketBuffer, SocketWriter } from 'socket-serializer';

import type * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { CreateUniqId } from '../IpcBusUtils';

import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';
import { IpcBusBrokerSocket, IpcBusBrokerSocketClient } from './IpcBusBrokerSocket';

/** @internal */
export class IpcBusBrokerNode extends IpcBusBrokerImpl {
    private _socketBridge: IpcBusBrokerSocket;
    private _socketWriter: SocketWriter;
    private _ipcPacketBuffer: IpcPacketBuffer;

    private _peer: Client.IpcBusPeer;

    constructor(contextType: Client.IpcBusProcessType) {
        super(contextType);

        this._peer = {
            id: `${contextType}.${CreateUniqId()}`,
            process: {
                type: contextType,
                pid: process ? process.pid : -1
            },
            name: ''
        }

        this._subscriptions.client = {
            channelAdded: (channel) => {
                this.bridgeAddChannel(channel);
            },
            channelRemoved: (channel) => {
                this.bridgeRemoveChannel(channel);
            }
        };
    }

    protected _reset(closeServer: boolean) {
        this.bridgeClose();
        super._reset(closeServer);
    }

    protected bridgeConnect(socket: net.Socket) {
        const client: IpcBusBrokerSocketClient = {
            onSocketPacket: (socket: net.Socket, ipcPacketBuffer: IpcPacketBuffer) => {
            },
            onSocketError: (socket: net.Socket, err: string) => {
                this.bridgeClose();
            },
            onSocketClose: (socket: net.Socket) => {
                this.bridgeClose();
            },
            onSocketEnd: (socket: net.Socket) => {
                this.bridgeClose();
            },
        };

        this._socketBridge = new IpcBusBrokerSocket(socket, client);
        this._socketWriter = new SocketWriter(this._socketBridge.socket);
        this._ipcPacketBuffer = new IpcPacketBuffer();

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
            this._socketWriter = null;
            this._ipcPacketBuffer = null;
        }
        // this._bridgeChannels.clear();
        // const channels = this._subscriptions.getChannels();
        // for (let i = 0, l = channels.length; i < l; ++i) {
        //     this.brokerRemoveChannel();
        // }
    }

    protected bridgeAddChannel(channel: string) {
        if (this._socketWriter) {
            const ipcBusCommand: IpcBusCommand = {
                kind: IpcBusCommand.Kind.AddChannelListener,
                channel,
                peer: this._peer
            };
            this._ipcPacketBuffer.writeArray(this._socketWriter, [ipcBusCommand]);
        }
    }

    protected bridgeRemoveChannel(channel: string) {
        if (this._socketWriter) {
            const ipcBusCommand: IpcBusCommand = {
                kind: IpcBusCommand.Kind.RemoveChannelListener,
                channel,
                peer: this._peer
            };
            this._ipcPacketBuffer.writeArray(this._socketWriter, [ipcBusCommand]);
        }
    }

    protected bridgeBroadcastMessage(socket: net.Socket, ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        if (socket !== this._socketBridge.socket) {
            this._socketBridge.socket.write(ipcPacketBuffer.buffer);
        }
    }
}
