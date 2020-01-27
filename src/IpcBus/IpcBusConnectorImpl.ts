import * as uuid from 'uuid';

// import { IpcPacketBuffer } from 'socket-serializer';
import { IpcBusConnector } from './IpcBusConnector';
import { IpcBusCommand } from './IpcBusCommand';
import * as Client from './IpcBusClient';
import { CheckLogLevel } from './IpcBusUtils';

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

    trackCommandPost(ipcBusCommand: IpcBusCommand, args?: any[]) {
        ipcBusCommand.log = ipcBusCommand.log || {};
        ipcBusCommand.log.sent = {
            id: `${this._peer.id}-${this._messageId++}`,
            timestamp: Date.now().valueOf()
        };
    }

    trackCommandReceived(peer: Client.IpcBusPeer, local: boolean, ipcBusCommand: IpcBusCommand, args?: any[]): void {
        if (ipcBusCommand.log == null) {
            return;
        }
        const ipcBusCommandLog: IpcBusCommand = {
            kind: IpcBusCommand.Kind.Log,
            peer,
            channel: ''
        };
        ipcBusCommandLog.log = ipcBusCommandLog.log || {};
        ipcBusCommandLog.log.received = {
            command: ipcBusCommand
        };
        this.trackCommandPost(ipcBusCommandLog, args);
        this.postCommand(ipcBusCommandLog);
    }

    abstract handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake>;
    abstract shutdown(client: IpcBusConnector.Client, options: Client.IpcBusClient.CloseOptions): Promise<void>;
    abstract postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;
    abstract postBuffer(buffer: Buffer): void;
}
