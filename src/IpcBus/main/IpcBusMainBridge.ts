/// <reference types='electron' />

import * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
// import { IpcBusTransportNet } from '../node/IpcBusTransportNet';
import { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusConnectorImpl } from '../IpcBusConnectorImpl';
import { IpcBusTransportMultiImpl } from '../IpcBusTransportMultIImpl'; 
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
    }

    postBuffer(buffer: Buffer) {
    }
}

export class IpcBusBridgeTransportMain extends IpcBusTransportMultiImpl { // implements IpcBusBridgeClient {
    protected _bridge: IpcBusBridgeImpl;

    constructor(connector: IpcBusConnector, bridge: IpcBusBridgeImpl) {
        super(connector);
        this._bridge = bridge;
    }
    
    // connect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
    //     return Promise.resolve();
    // }

    // close(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
    //     return Promise.resolve();
    // }

    // broadcastBuffer(ipcBusCommand: IpcBusCommand, buffer?: Buffer): void {
    //     throw 'not implemented';
    // }

    // broadcastPacketRaw(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): void {
    //     this.onConnectorBufferReceived(null, ipcBusCommand, rawContent);
    // }

    // broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void {
    //     this.onConnectorPacketReceived(ipcBusCommand, ipcPacketBuffer);
    // }

    protected ipcPostMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        this._bridge._onMainMessageReceived(ipcBusCommand, args);
    }
}
