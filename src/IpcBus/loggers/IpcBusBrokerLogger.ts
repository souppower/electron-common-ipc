import * as net from 'net';

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusClientInterfaces from '../IpcBusClientInterfaces';
import * as IpcBusBrokerInterfaces from '../IpcBusBrokerInterfaces';

import { IpcBusCommand } from '../IpcBusCommand';

import { IpcBusBrokerImpl } from '../IpcBusBrokerImpl';

/** @internal */
export abstract class IpcBusBrokerLogger extends IpcBusBrokerImpl {
    constructor(processType: IpcBusClientInterfaces.IpcBusProcessType, options: IpcBusBrokerInterfaces.IpcBusBroker.CreateOptions) {
        super(processType, options);
    }

    protected abstract addLog(socket: net.Socket, ipcPacketBuffer: IpcPacketBuffer, ipcBusCommand: IpcBusCommand, args: any[]): void;

    onSocketPacket(socket: net.Socket, packet: IpcPacketBuffer): void {
        let ipcBusCommand: IpcBusCommand = packet.parseArrayAt(0);
        let args = packet.parseArrayAt(1);
        this.addLog(socket, packet, ipcBusCommand, args);

        super.onSocketPacket(socket, packet);
    }
}
