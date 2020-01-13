import * as uuid from 'uuid';

// import { IpcPacketBuffer } from 'socket-serializer';
import { IpcBusConnector } from './IpcBusConnector';
import { IpcBusCommand } from './IpcBusCommand';
import * as Client from './IpcBusClient';

// Implementation for renderer process
/** @internal */
export abstract class IpcBusConnectorImpl implements IpcBusConnector {
    protected _client: IpcBusConnector.Client;
    protected _peer: Client.IpcBusPeer;
    
    constructor(contextType: Client.IpcBusProcessType) {
        this._peer = {
            id: uuid.v1(),
            name: '',
            process: {
                type: contextType,
                pid: -1
            }
        };
    }

    get process(): Client.IpcBusProcess {
        return this._peer.process;
    }

    addClient(client: IpcBusConnector.Client) {
        this._client = client;
    }

    removeClient(client: IpcBusConnector.Client) {
        if (this._client === client) {
            this._client = null;
        }
    }

    abstract ipcHandshake(options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake>;
    abstract ipcShutdown(options: Client.IpcBusClient.CloseOptions): Promise<void>;
    abstract ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;
}
