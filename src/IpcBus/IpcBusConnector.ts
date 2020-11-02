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
        // noSerialization?: boolean;
    }

    export enum ReceivedFeedback {
        Managed,
        UnManaged,
        Eaten
    }

    /** @internal */
    export interface Client {
        peer: Client.IpcBusPeer;
        onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): boolean;
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
    postBuffer(buffer: Buffer): void;

    logMessageSend(previousLog: IpcBusCommand.Log, ipcBusCommand: IpcBusCommand): IpcBusCommand.Log;
    logLocalMessage(peer: Client.IpcBusPeer, ipcBusCommand: IpcBusCommand, args: any[]): IpcBusCommand.Log;
    logMessageGet(peer: Client.IpcBusPeer, local: boolean, ipcBusCommand: IpcBusCommand, args: any[]): IpcBusCommand.Log;
}

