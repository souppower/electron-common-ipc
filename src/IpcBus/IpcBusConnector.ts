import type { IpcPacketBufferCore, IpcPacketBuffer } from 'socket-serializer';

import type { IpcBusCommand } from './IpcBusCommand';
import type * as Client from './IpcBusClient';
import type { IpcBusLogConfig } from './log/IpcBusLogConfig';

/** @internal */
export namespace IpcBusConnector {
    /** @internal */
    export interface Handshake {
        process: Client.IpcBusProcess;
        logLevel: IpcBusLogConfig.Level;
        // noSerialization?: boolean;
    }

    /** @internal */
    export interface Client {
        peer: Client.IpcBusPeer;
        onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): boolean;
        onConnectorContentReceived(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): boolean;
        onConnectorArgsReceived(ipcBusCommand: IpcBusCommand, args: any[]): boolean;
        onConnectorShutdown(): void;
    }
}

/** @internal */
export interface IpcBusConnector {
    readonly process: Client.IpcBusProcess | null;

    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake>;
    shutdown(client: IpcBusConnector.Client, options: Client.IpcBusClient.CloseOptions): Promise<void>;
    postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;
    postBuffers(buffers: Buffer[]): void;

    logMessageSend(previousLog: IpcBusCommand.Log, ipcBusCommand: IpcBusCommand): IpcBusCommand.Log;
    logLocalMessage(peer: Client.IpcBusPeer, ipcBusCommand: IpcBusCommand, args: any[]): IpcBusCommand.Log;
    logMessageGet(peer: Client.IpcBusPeer, local: boolean, ipcBusCommand: IpcBusCommand, args: any[]): IpcBusCommand.Log;
}

