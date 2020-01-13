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
        onConnectorClosed(): void;
    }
}

/** @internal */
export interface IpcBusConnector {
    readonly process: Client.IpcBusProcess;

    ipcHandshake(options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake>;
    ipcShutdown(options: Client.IpcBusClient.CloseOptions): Promise<void>;
    ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;

    addClient(client: IpcBusConnector.Client): void;
    removeClient(client: IpcBusConnector.Client): void;
}

