import { IpcPacketBuffer } from 'socket-serializer';

import { IpcBusCommand } from './IpcBusCommand';
import * as Client from './IpcBusClient';
import { IpcBusLogConfig } from './log/IpcBusLogConfig';

/** @internal */
export namespace IpcBusConnector {
    /** @internal */
    export interface Handshake {
        process: Client.IpcBusProcess;
        logLevel: IpcBusLogConfig.Level;
    }

    /** @internal */
    export interface Client {
        peer: Client.IpcBusPeer;
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

    logMessageCreation(ipcBusCommand: IpcBusCommand): void;
    logResponseCreation(ipcBusCommandOrigin: IpcBusCommand, ipcBusCommand: IpcBusCommand): void;

    logResponse(ipcBusCommand: IpcBusCommand, args?: any[]): void;
    logMessageReceived(peer: Client.IpcBusPeer, local: boolean, ipcBusCommand: IpcBusCommand, args?: any[]): void;
}

