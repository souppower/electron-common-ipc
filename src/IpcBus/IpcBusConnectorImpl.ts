import * as uuid from 'uuid';

// import { IpcPacketBuffer } from 'socket-serializer';
import { IpcBusConnector } from './IpcBusConnector';
import { IpcBusCommand } from './IpcBusCommand';
import * as Client from './IpcBusClient';
import { IpcBusLog } from './log/IpcBusLog';
import { GetLogLevel } from './log/IpcBusLogImpl';

// Implementation for renderer process
/** @internal */
export abstract class IpcBusConnectorImpl implements IpcBusConnector {
    protected _client: IpcBusConnector.Client;
    protected _peer: Client.IpcBusPeer;
    protected _messageId: number;
    protected _logLevel: IpcBusLog.Level;

    constructor(contextType: Client.IpcBusProcessType) {
        this._peer = {
            id: uuid.v1(),
            name: '',
            process: {
                type: contextType,
                pid: process ? process.pid: -1
            }
        };
        this._logLevel = GetLogLevel();
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

    trackMessageCreation(ipcBusCommand: IpcBusCommand) {
        if (this._logLevel & IpcBusLog.Level.Sent) {
            const id = `${this._peer.id}-${this._messageId++}`;
            ipcBusCommand.log = ipcBusCommand.log || {
                id,
                timestamp: Date.now()
            };
        }
    }

    trackResponseCreation(ipcBusCommandOrigin: IpcBusCommand, ipcBusCommand: IpcBusCommand) {
        if (this._logLevel & IpcBusLog.Level.Sent) {
            const id = ipcBusCommandOrigin.log?.id || `${this._peer.id}-${this._messageId++}`;
            ipcBusCommand.log = ipcBusCommand.log || {
                id,
                timestamp: Date.now()
            };
            ipcBusCommand.log.previous = ipcBusCommandOrigin;
        }
    }

    logResponse(ipcBusCommand: IpcBusCommand, args?: any[]) {
        if (this._logLevel & IpcBusLog.Level.Sent) {
            // Clone first level
            const ipcBusCommandLog: IpcBusCommand = Object.assign({}, ipcBusCommand);
            ipcBusCommandLog.kind = IpcBusCommand.Kind.LogRequestResponse;
            ipcBusCommand.log.local = true;
            this.postCommand(ipcBusCommandLog, args);
        }
    }

    logMessageReceived(peer: Client.IpcBusPeer, local: boolean, ipcBusCommand: IpcBusCommand, args?: any[]): void {
        if (this._logLevel >= IpcBusLog.Level.Received) {
            const ipcBusCommandLog: IpcBusCommand = {
                kind: IpcBusCommand.Kind.LogGetMessage,
                peer,
                channel: ''
            };
            this.trackMessageCreation(ipcBusCommandLog);
            ipcBusCommandLog.log.local = local;
            ipcBusCommandLog.log.previous = ipcBusCommand;
            // no args
            this.postCommand(ipcBusCommandLog);
        }
    }

    abstract handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake>;
    abstract shutdown(client: IpcBusConnector.Client, options: Client.IpcBusClient.CloseOptions): Promise<void>;
    abstract postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;
    abstract postBuffer(buffer: Buffer): void;
}
