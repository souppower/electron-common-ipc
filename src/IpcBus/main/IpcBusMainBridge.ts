/// <reference types='electron' />

import * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
// import { IpcBusTransportNet } from '../node/IpcBusTransportNet';
import { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusConnectorImpl } from '../IpcBusConnectorImpl';
import { IpcBusTransportMultiImpl } from '../IpcBusTransportMultIImpl'; 
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl'; 

export class IpcBusBridgeConnectorMain extends IpcBusConnectorImpl {
    constructor(contextType: Client.IpcBusProcessType) {
       super(contextType);
    }

    ipcHandshake(options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        const handshake: IpcBusConnector.Handshake = {
            process: this.process
        }
        return Promise.resolve(handshake);
    }

    ipcShutdown(options: Client.IpcBusClient.CloseOptions): Promise<void> {
        return Promise.resolve();
    }

    ipcPostCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
    }

    ipcPostBuffer(buffer: Buffer) {
    }
}

export class IpcBusBridgeTransportMain extends IpcBusTransportMultiImpl {
    protected _bridge: IpcBusBridgeImpl;

    constructor(connector: IpcBusConnector, bridge: IpcBusBridgeImpl) {
        super(connector);
        this._bridge = bridge;
    }

    protected ipcPostCommandMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        this._bridge._onMainMessageReceived(ipcBusCommand, args);
    }
}
