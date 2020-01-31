import * as uuid from 'uuid';

// import { IpcPacketBuffer } from 'socket-serializer';
import { IpcBusConnector } from './IpcBusConnector';
import { IpcBusCommand } from './IpcBusCommand';
import * as Client from './IpcBusClient';
import { IpcBusLogConfig } from './log/IpcBusLogConfig';
import { ipcBusLogConfig } from './log/IpcBusLogConfigImpl';

// Implementation for renderer process
/** @internal */
export abstract class IpcBusConnectorImpl implements IpcBusConnector {
    protected _client: IpcBusConnector.Client;
    protected _process: Client.IpcBusProcess;
    protected _messageId: string;
    protected _messageCount: number;
    protected _logLevel: IpcBusLogConfig.Level;

    constructor(contextType: Client.IpcBusProcessType) {
        this._process = {
            type: contextType,
            pid: process ? process.pid: -1
        };
        this._logLevel = ipcBusLogConfig.level;
        this._messageId = uuid.v1();
        this._messageCount = 0;
    }

    get process(): Client.IpcBusProcess {
        return this._process;
    }

    protected addClient(client: IpcBusConnector.Client) {
        this._client = client;
    }

    protected removeClient(client: IpcBusConnector.Client) {
        if (this._client === client) {
            this._client = null;
        }
    }

    logMessageCreation(ipcBusCommand: IpcBusCommand) {
        if (this._logLevel & IpcBusLogConfig.Level.Sent) {
            const id = `${this._messageId}-${this._messageCount++}`;
            ipcBusCommand.log = ipcBusCommand.log || {
                id,
                timestamp: Date.now()
            };
        }
    }

    logResponseCreation(ipcBusCommandOrigin: IpcBusCommand, ipcBusCommand: IpcBusCommand) {
        if (this._logLevel & IpcBusLogConfig.Level.Sent) {
            const id = ipcBusCommandOrigin.log?.id || `${this._messageId}-${this._messageCount++}`;
            ipcBusCommand.log = ipcBusCommand.log || {
                id,
                timestamp: Date.now()
            };
            ipcBusCommand.log.previous = ipcBusCommandOrigin;
        }
    }

    logResponse(ipcBusCommand: IpcBusCommand, args?: any[]) {
        if (this._logLevel & IpcBusLogConfig.Level.Sent) {
            // Clone first level
            const ipcBusCommandLog: IpcBusCommand = Object.assign({}, ipcBusCommand);
            ipcBusCommandLog.kind = IpcBusCommand.Kind.LogRequestResponse;
            ipcBusCommand.log.local = true;
            this.postCommand(ipcBusCommandLog, args);
        }
    }

    logMessageReceived(peer: Client.IpcBusPeer, local: boolean, ipcBusCommand: IpcBusCommand, args?: any[]): void {
        if (this._logLevel >= IpcBusLogConfig.Level.Received) {
            const ipcBusCommandLog: IpcBusCommand = {
                kind: IpcBusCommand.Kind.LogGetMessage,
                peer,
                channel: ''
            };
            this.logMessageCreation(ipcBusCommandLog);
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
