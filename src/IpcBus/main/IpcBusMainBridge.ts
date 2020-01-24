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
    
    constructor(contextType: Client.IpcBusProcessType) {
       super(contextType);
    }

    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        const handshake: IpcBusConnector.Handshake = {
            process: this.process
        }
        return Promise.resolve(handshake);
    }

    shutdown(client: IpcBusConnector.Client, options: Client.IpcBusClient.CloseOptions): Promise<void> {
        return Promise.resolve();
    }

    postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        // Bypassed by ipcPostMessage and postAdmin below
        throw 'not implemented';
    }

    postBuffer(buffer: Buffer) {
        throw 'not implemented';
    }
}

export class IpcBusBridgeTransportMain extends IpcBusTransportMultiImpl { // implements IpcBusBridgeClient {
    protected _bridge: IpcBusBridgeImpl;

    constructor(connector: IpcBusConnector, bridge: IpcBusBridgeImpl) {
        super(connector);
        this._bridge = bridge;
    }

    protected postAdmin(ipcBusCommand: IpcBusCommand): void {
        // skipped, admin messages does not interest Bridge
        // this._bridge.trackAdmin(ipcBusCommand);
    }

    protected postMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        this._bridge._onMainMessageReceived(ipcBusCommand, args);
    }
}
