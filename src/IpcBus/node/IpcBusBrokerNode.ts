import type * as net from 'net';

import { IpcPacketBuffer, SocketWriter } from 'socket-serializer';

import type * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { CreateUniqId } from '../IpcBusUtils';

import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';
import type { IpcBusBrokerSocket } from './IpcBusBrokerSocket';

/** @internal */
export class IpcBusBrokerNode extends IpcBusBrokerImpl {
    private _socketBridge: IpcBusBrokerSocket;
    private _socketWriter: SocketWriter;
    private _ipcPacketBuffer: IpcPacketBuffer;
    private _bridgeChannels: Set<string>;

    private _peer: Client.IpcBusPeer;

    constructor(contextType: Client.IpcBusProcessType) {
        super(contextType);

        this._ipcPacketBuffer = new IpcPacketBuffer();
        this._bridgeChannels = new Set<string>();

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
                this.bridgeBroadcastAddChannel(channel);
            },
            channelRemoved: (channel) => {
                this.bridgeBroadcastRemoveChannel(channel);
            }
        };
    }

    protected _reset(closeServer: boolean) {
        this.bridgeClose();
        super._reset(closeServer);
    }

    protected bridgeConnect(socketClient: IpcBusBrokerSocket, ipcBusCommand: IpcBusCommand) {
        this._socketBridge = socketClient;
        this._socketWriter = new SocketWriter(this._socketBridge.socket);

        if (ipcBusCommand.channels) {
            for (let i = 0, l = ipcBusCommand.channels.length; i < l; ++i) {
                this._subscriptions.addRef(ipcBusCommand.channels[i], socketClient.socket, ipcBusCommand.peer);
            }
        }

        // this._socketBridge = socket;
        // this._bridgeChannels.clear();
        const channels = this._subscriptions.getChannels();
        this._bridgeChannels = new Set(channels);
    }

    protected bridgeClose(socket?: net.Socket) {
        if (this._socketBridge && ((socket == null) || (socket === this._socketBridge.socket))) {
            this._socketBridge = null;
            this._socketWriter = null;
            this._bridgeChannels.clear();
        }
    }

    protected bridgeAddChannel(socket: net.Socket, ipcBusCommand: IpcBusCommand) {
        this._bridgeChannels.add(ipcBusCommand.channel);
    }

    protected bridgeRemoveChannel(socket: net.Socket, ipcBusCommand: IpcBusCommand) {
        this._bridgeChannels.delete(ipcBusCommand.channel);
    }

    protected bridgeBroadcastAddChannel(channel: string) {
        if (this._socketWriter) {
            const ipcBusCommand: IpcBusCommand = {
                kind: IpcBusCommand.Kind.AddChannelListener,
                channel,
                peer: this._peer
            };
            this._ipcPacketBuffer.writeArray(this._socketWriter, [ipcBusCommand]);
        }
    }

    protected bridgeBroadcastRemoveChannel(channel: string) {
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
        if (this._bridgeChannels.has(ipcBusCommand.channel)) {
            if (socket !== this._socketBridge.socket) {
                this._socketBridge.socket.write(ipcPacketBuffer.buffer);
            }
        }
    }

    protected bridgeBroadcast(socket: net.Socket, ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        if (this._socketBridge.socket) {
            this._socketBridge.socket.write(ipcPacketBuffer.buffer);
        }
    }
}
