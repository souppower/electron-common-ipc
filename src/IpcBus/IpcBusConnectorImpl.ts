import * as uuid from 'uuid';

// import { IpcPacketBuffer } from 'socket-serializer';
import { IpcBusConnector } from './IpcBusConnector';
import { IpcBusCommand } from './IpcBusCommand';
import * as Client from './IpcBusClient';
import { CheckLogLevel, LogLevel } from './IpcBusUtils';

// Implementation for renderer process
/** @internal */
export abstract class IpcBusConnectorImpl implements IpcBusConnector {
    protected _client: IpcBusConnector.Client;
    protected _peer: Client.IpcBusPeer;
    protected _messageId: number;
    protected _logLevel: number;

    constructor(contextType: Client.IpcBusProcessType) {
        this._peer = {
            id: uuid.v1(),
            name: '',
            process: {
                type: contextType,
                pid: process ? process.pid: -1
            }
        };
        this._logLevel = CheckLogLevel();
        this._messageId = 0;
    }

    get process(): Client.IpcBusProcess {
        return this._peer.process;
    }

    protected addClient(client: IpcBusConnector.Client) {
        this._client = client;
    }

    protected removeClient(client: IpcBusConnector.Client) {
        if (this._client === client) {
            this._client = null;
        }
    }

    trackMessageCreation(ipcBusCommand: IpcBusCommand, args?: any[]) {
        if (this._logLevel & LogLevel.Sent) {
            ipcBusCommand.log = ipcBusCommand.log || {};
            ipcBusCommand.log.post = {
                id: `${this._peer.id}-${this._messageId++}`,
                timestamp: Date.now()
            };
        }
    }

    trackMessageLocal(ipcBusCommand: IpcBusCommand, args?: any[]) {
        if (this._logLevel & LogLevel.Sent) {
            const ipcBusCommandLog: IpcBusCommand = {
                kind: IpcBusCommand.Kind.LogSend,
                peer: ipcBusCommand.peer,
                channel: ''
            };
            this.trackMessageCreation(ipcBusCommandLog, args);
            ipcBusCommandLog.log.received = {
                command: ipcBusCommand,
                local: true
            };
            this.postCommand(ipcBusCommandLog);
        }
    }

    trackMessageReceived(peer: Client.IpcBusPeer, local: boolean, ipcBusCommand: IpcBusCommand, args?: any[]): void {
        if (this._logLevel >= LogLevel.Received) {
            const ipcBusCommandLog: IpcBusCommand = {
                kind: IpcBusCommand.Kind.LogGet,
                peer,
                channel: ''
            };
            this.trackMessageCreation(ipcBusCommandLog, args);
            ipcBusCommandLog.log.received = {
                command: ipcBusCommand,
                local
            };
            this.postCommand(ipcBusCommandLog);
        }
    }

    abstract handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake>;
    abstract shutdown(client: IpcBusConnector.Client, options: Client.IpcBusClient.CloseOptions): Promise<void>;
    abstract postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;
    abstract postBuffer(buffer: Buffer): void;
}
