import { IpcPacketBuffer } from 'socket-serializer';

import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusLog } from './log/IpcBusLog';
import * as Client from './IpcBusClient';

/** @internal */
export namespace IpcBusConnector {
    /** @internal */
    export interface Handshake {
        process: Client.IpcBusProcess;
        logLevel?: IpcBusLog.Level;
    }

    /** @internal */
    export interface Client {
        onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void;
        onConnectorBufferReceived(__ignore__: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): void;
        onConnectorShutdown(): void;
    }
}

/** @internal */
export interface IpcBusConnector {
    readonly process: Client.IpcBusProcess | null;

    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake>;
    shutdown(client: IpcBusConnector.Client, options: Client.IpcBusClient.CloseOptions): Promise<void>;
    postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;
    postBuffer(buffer: Buffer): void;

    trackMessageCreation(ipcBusCommand: IpcBusCommand, args?: any[]): void;
    trackMessageLocal(ipcBusCommand: IpcBusCommand, args?: any[]): void;
    trackMessageReceived(peer: Client.IpcBusPeer, local: boolean, ipcBusCommand: IpcBusCommand, args?: any[]): void;
}

