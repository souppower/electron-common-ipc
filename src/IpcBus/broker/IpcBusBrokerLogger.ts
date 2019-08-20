import * as net from 'net';

import { IpcPacketBuffer } from 'socket-serializer';

import * as Client from '../IpcBusClient';
import * as Broker from './IpcBusBroker';

import { IpcBusCommand } from '../IpcBusCommand';

import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';

/** @internal */
export abstract class IpcBusBrokerLogger extends IpcBusBrokerImpl {
    constructor(contextType: Client.IpcBusProcessType, options: Broker.IpcBusBroker.CreateOptions) {
        super(contextType, options);
    }

    protected abstract addLog(socket: net.Socket, ipcPacketBuffer: IpcPacketBuffer, ipcBusCommand: IpcBusCommand, args: any[]): void;

    onSocketPacket(socket: net.Socket, packet: IpcPacketBuffer): void {
        const ipcBusCommand: IpcBusCommand = packet.parseArrayAt(0);
        const args = packet.parseArrayAt(1);
        this.addLog(socket, packet, ipcBusCommand, args);

        super.onSocketPacket(socket, packet);
    }
}
