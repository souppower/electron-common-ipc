import type * as net from 'net';

import { IpcPacketBuffer, IpcPacketBufferList, SocketWriter } from 'socket-serializer';

import type * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { ChannelConnectionMap, CreateUniqId } from '../IpcBusUtils';

import { IpcBusBrokerImpl, SocketBufferListtWrite } from './IpcBusBrokerImpl';
import type { IpcBusBrokerSocket } from './IpcBusBrokerSocket';

/** @internal */
export class IpcBusBrokerNode extends IpcBusBrokerImpl {
    private _socketBridge: IpcBusBrokerSocket;
    private _socketWriter: SocketWriter;
    private _ipcPacketBuffer: IpcPacketBuffer;

    private _peer: Client.IpcBusPeer;

    protected _bridgeSubscriptions: ChannelConnectionMap<string, string>;

    constructor(contextType: Client.IpcBusProcessType) {
        super(contextType);

        this._ipcPacketBuffer = new IpcPacketBuffer();
        this._bridgeSubscriptions = new ChannelConnectionMap<string, string>(
            'IPCBus:Bridge',
            (conn) => conn);

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
                this._bridgeSubscriptions.addRef(ipcBusCommand.channels[i], 'IPCBus:Bridge', ipcBusCommand.peer);
            }
        }
    }

    protected bridgeClose(socket?: net.Socket) {
        if (this._socketBridge && ((socket == null) || (socket === this._socketBridge.socket))) {
            this._socketBridge = null;
            this._socketWriter = null;
            this._bridgeSubscriptions.clear();
        }
    }

    protected bridgeAddChannel(socket: net.Socket, ipcBusCommand: IpcBusCommand) {
        this._bridgeSubscriptions.addRef(ipcBusCommand.channel, 'IPCBus:Bridge', ipcBusCommand.peer);
    }

    protected bridgeRemoveChannel(socket: net.Socket, ipcBusCommand: IpcBusCommand) {
        this._bridgeSubscriptions.release(ipcBusCommand.channel, 'IPCBus:Bridge', ipcBusCommand.peer);
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

    protected bridgeBroadcastMessage(socket: net.Socket, ipcBusCommand: IpcBusCommand, ipcPacketBufferList: IpcPacketBufferList) {
        if (this._bridgeSubscriptions.hasChannel(ipcBusCommand.channel)) {
            if (socket !== this._socketBridge.socket) {
                SocketBufferListtWrite(this._socketBridge.socket, ipcPacketBufferList);
            }
        }
    }

    protected bridgeBroadcast(socket: net.Socket, ipcBusCommand: IpcBusCommand, ipcPacketBufferList: IpcPacketBufferList) {
        if (this._socketBridge.socket) {
            SocketBufferListtWrite(this._socketBridge.socket, ipcPacketBufferList);
        }
    }
}
