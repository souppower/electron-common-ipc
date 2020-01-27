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
            logLevel: this._logLevel
        }
        return Promise.resolve(handshake);
    }

    shutdown(client: IpcBusConnector.Client, options: Client.IpcBusClient.CloseOptions): Promise<void> {
        return Promise.resolve();
    }

    postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        // this._logLevel && this.trackCommandPost(ipcBusCommand, args);
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.AddChannelListener:
                break;

            case IpcBusCommand.Kind.RemoveChannelListener:
                break;

            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                break;

            case IpcBusCommand.Kind.RemoveListeners:
                break;

            default :
                this._bridge._onMainMessageReceived(ipcBusCommand, args);
                break;
        }
    }

    postBuffer(buffer: Buffer) {
        throw 'not implemented';
    }
}

export class IpcBusBridgeTransportMain extends IpcBusTransportMultiImpl { // implements IpcBusBridgeClient {
}