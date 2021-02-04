/// <reference types='electron' />

import type * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
// import { IpcBusTransportNet } from '../node/IpcBusTransportNet';
import type { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusConnectorImpl } from '../IpcBusConnectorImpl';
import { IpcBusTransportMultiImpl } from '../IpcBusTransportMultiImpl';
import type { IpcBusBridgeImpl } from './IpcBusBridgeImpl';

export class IpcBusBridgeConnectorMain extends IpcBusConnectorImpl {
    protected _bridge: IpcBusBridgeImpl;

    constructor(contextType: Client.IpcBusProcessType, bridge: IpcBusBridgeImpl) {
        super(contextType);

        this._bridge = bridge;

        this.postDirectMessage = this.postCommand;
    }

    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        const handshake: IpcBusConnector.Handshake = {
            process: this.process,
            logLevel: this._log.level
        }
        return Promise.resolve(handshake);
    }

    shutdown(options: Client.IpcBusClient.CloseOptions): Promise<void> {
        return Promise.resolve();
    }

    postDirectMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        // fake body
    }

    postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.RemoveChannelAllListeners:
            case IpcBusCommand.Kind.RemoveListeners:
                throw 'IpcBusTransportMultiImpl - should not happen';
    
            case IpcBusCommand.Kind.AddChannelListener:
            case IpcBusCommand.Kind.RemoveChannelListener:
                this._bridge._onBridgeChannelChanged(ipcBusCommand);
                break;

            default :
                this._bridge._onMainMessageReceived(ipcBusCommand, args);
                break;
        }
    }

    postBuffers(buffers: Buffer[]) {
        throw 'not implemented';
    }
}

export class IpcBusBridgeTransportMain extends IpcBusTransportMultiImpl { // implements IpcBusBridgeClient {
    // broadcastBuffers(ipcBusCommand: IpcBusCommand, buffers: Buffer[]): void {
    //     throw new Error('Method not implemented.');
    // }

    // broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): void {
    //     throw new Error('Method not implemented.');
    // }

    // broadcastContent(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBufferCore.RawData): void {
    //     this.onConnectorContentReceived(ipcBusCommand, rawContent);
    // }
}