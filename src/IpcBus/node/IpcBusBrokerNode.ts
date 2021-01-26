import type * as net from 'net';

import { IpcPacketWriter, IpcPacketBufferList, SocketWriter } from 'socket-serializer';

import type * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { ChannelConnectionMap, CreateUniqId, IsWebContentsChannel } from '../IpcBusUtils';

import { IpcBusBrokerImpl, WriteBuffersToSocket } from './IpcBusBrokerImpl';
import type { IpcBusBrokerSocket } from './IpcBusBrokerSocket';

/** @internal */
export class IpcBusBrokerNode extends IpcBusBrokerImpl {
    private _socketBridge: IpcBusBrokerSocket;
    private _socketWriter: SocketWriter;
    private _packetOut: IpcPacketWriter;

    private _peer: Client.IpcBusPeer;

    private _bridgeSubscriptions: ChannelConnectionMap<string, string>;

    constructor(contextType: Client.IpcBusProcessType) {
        super(contextType);

        this._packetOut = new IpcPacketWriter();
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
                this.broadcastToBridgeAddChannel(channel);
            },
            channelRemoved: (channel) => {
                this.broadcastToBridgeRemoveChannel(channel);
            }
        };
    }

    protected _reset(closeServer: boolean) {
        this.onBridgeClosed();
        super._reset(closeServer);
    }

    protected onBridgeConnected(socketClient: IpcBusBrokerSocket, ipcBusCommand: IpcBusCommand) {
        this._socketBridge = socketClient;
        this._socketWriter = new SocketWriter(this._socketBridge.socket);

        if (Array.isArray(ipcBusCommand.channels)) {
            this._bridgeSubscriptions.addRefs(ipcBusCommand.channels, 'IPCBus:Bridge', ipcBusCommand.peer);
        }

        const channels = this._subscriptions.getChannels();
        for (let i = 0, l = channels.length; i < l; ++i) {
            this.broadcastToBridgeAddChannel(channels[i]);
        }
    }

    protected onBridgeClosed(socket?: net.Socket) {
        if (this._socketBridge && ((socket == null) || (socket === this._socketBridge.socket))) {
            this._socketBridge = null;
            this._socketWriter = null;
            this._bridgeSubscriptions.clear();
        }
    }

    protected onBridgeAddChannel(socket: net.Socket, ipcBusCommand: IpcBusCommand) {
        this._bridgeSubscriptions.addRef(ipcBusCommand.channel, 'IPCBus:Bridge', ipcBusCommand.peer);
    }

    protected onBridgeRemoveChannel(socket: net.Socket, ipcBusCommand: IpcBusCommand) {
        this._bridgeSubscriptions.release(ipcBusCommand.channel, 'IPCBus:Bridge', ipcBusCommand.peer);
    }

    protected broadcastToBridgeAddChannel(channel: string) {
        if (this._socketWriter) {
            const ipcBusCommand: IpcBusCommand = {
                kind: IpcBusCommand.Kind.AddChannelListener,
                channel,
                peer: this._peer
            };
            this._packetOut.write(this._socketWriter, [ipcBusCommand]);
        }
    }

    protected broadcastToBridgeRemoveChannel(channel: string) {
        if (this._socketWriter) {
            const ipcBusCommand: IpcBusCommand = {
                kind: IpcBusCommand.Kind.RemoveChannelListener,
                channel,
                peer: this._peer
            };
            this._packetOut.write(this._socketWriter, [ipcBusCommand]);
        }
    }

    protected broadcastToBridgeMessage(socket: net.Socket, ipcBusCommand: IpcBusCommand, ipcPacketBufferList: IpcPacketBufferList) {
        if (socket !== this._socketBridge.socket) {
            if (this._bridgeSubscriptions.hasChannel(ipcBusCommand.channel) || IsWebContentsChannel(ipcBusCommand.channel)) {
                WriteBuffersToSocket(this._socketBridge.socket, ipcPacketBufferList.buffers);
            }
        }
    }

    protected broadcastToBridge(socket: net.Socket, ipcBusCommand: IpcBusCommand, ipcPacketBufferList: IpcPacketBufferList) {
        if (this._socketBridge.socket) {
            WriteBuffersToSocket(this._socketBridge.socket, ipcPacketBufferList.buffers);
        }
    }
}
