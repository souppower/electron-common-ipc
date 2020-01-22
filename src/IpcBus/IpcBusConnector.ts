import { IpcPacketBuffer } from 'socket-serializer';

import { IpcBusCommand } from './IpcBusCommand';
import * as Client from './IpcBusClient';

/** @internal */
export namespace IpcBusConnector {
    /** @internal */
    export interface Handshake {
        process: Client.IpcBusProcess;
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
    readonly process: Client.IpcBusProcess;

    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake>;
    shutdown(client: IpcBusConnector.Client, options: Client.IpcBusClient.CloseOptions): Promise<void>;
    postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;
    postBuffer(buffer: Buffer): void;
}

