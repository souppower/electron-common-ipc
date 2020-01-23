import * as net from 'net';

import { IpcPacketBuffer, BufferListReader } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';

export interface IpcBusBrokerSocketClient {
    onSocketPacket(socket: net.Socket, ipcPacketBuffer: IpcPacketBuffer): void;
    onSocketError(socket: net.Socket, err: string): void;
    onSocketClose(socket: net.Socket): void;
};

export class IpcBusBrokerSocket {
    private _socket: net.Socket;
    protected _socketBinds: { [key: string]: (...args: any[]) => void };

    private _packetIn: IpcPacketBuffer;
    private _bufferListReader: BufferListReader;
    private _client: IpcBusBrokerSocketClient;

    constructor(socket: net.Socket, client: IpcBusBrokerSocketClient) {
        this._socket = socket;
        this._client = client;

        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Connect: ${this._socket.remotePort}`);

        this._bufferListReader = new BufferListReader();
        this._packetIn = new IpcPacketBuffer();

        this._socketBinds = {};
        this._socketBinds['error'] = this._onSocketError.bind(this);
        this._socketBinds['close'] = this._onSocketClose.bind(this);
        this._socketBinds['data'] = this._onSocketData.bind(this);
        this._socketBinds['end'] = this._onSocketEnd.bind(this);

        for (let key in this._socketBinds) {
            this._socket.addListener(key, this._socketBinds[key]);
        }
    }

    release() {
        if (this._socket) {
            for (let key in this._socketBinds) {
                this._socket.removeListener(key, this._socketBinds[key]);
            }
            this._socket.end();
            this._socket.unref();
            // this._socket.destroy();
            this._socket = null;
        }
    }

    protected _onSocketData(buffer: Buffer) {
        this._bufferListReader.appendBuffer(buffer);
        while (this._packetIn.decodeFromReader(this._bufferListReader)) {
            this._client.onSocketPacket(this._socket, this._packetIn);
            // Remove read buffer
            this._bufferListReader.reduce();
        }
    }

    protected _onSocketError(err: any) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Error on connection: ${this._socket.remotePort} - ${err}`);
        this._client.onSocketError(this._socket, err);
    }

    protected _onSocketClose() {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Close on connection: ${this._socket.remotePort}`);
        this._client.onSocketClose(this._socket);
    }

    protected _onSocketEnd() {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Close on connection: ${this._socket.remotePort}`);
        // this._client.onSocketClose(this._socket);
    }
}
