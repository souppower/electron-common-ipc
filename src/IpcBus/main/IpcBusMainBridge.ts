/// <reference types='electron' />

import * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
// import { IpcBusTransportNet } from '../node/IpcBusTransportNet';
import { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusConnectorImpl } from '../IpcBusConnectorImpl';
import { IpcBusTransportMultiImpl } from '../IpcBusTransportMultiImpl'; 
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl'; 

export class IpcBusBridgeConnectorMain extends IpcBusConnectorImpl {
    protected _bridge: IpcBusBridgeImpl;
    
    constructor(contextType: Client.IpcBusProcessType, bridge: IpcBusBridgeImpl) {
       super(contextType);

       this._bridge = bridge;
    }

    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        const handshake: IpcBusConnector.Handshake = {
            process: this.process,
            logChannel: this._logChannel
        }
        return Promise.resolve(handshake);
    }

    shutdown(client: IpcBusConnector.Client, options: Client.IpcBusClient.CloseOptions): Promise<void> {
        return Promise.resolve();
    }

    postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        this._logChannel && this.trackCommandPost(false, ipcBusCommand, args);
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage:
            case IpcBusCommand.Kind.RequestResponse:
            case IpcBusCommand.Kind.RequestClose:
            case IpcBusCommand.Kind.Log:
                this._bridge._onMainMessageReceived(ipcBusCommand, args);
                break;
            default: 
                this._bridge._trackAdmin(ipcBusCommand);
                break;
        }
    }

    postBuffer(buffer: Buffer) {
        throw 'not implemented';
    }
}

export class IpcBusBridgeTransportMain extends IpcBusTransportMultiImpl { // implements IpcBusBridgeClient {
}