/// <reference types='electron' />

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import * as Client from '../IpcBusClient';
import * as Bridge from './IpcBusBridge';
import { IpcBusCommand } from '../IpcBusCommand';
import {
    IPCBUS_TRANSPORT_RENDERER_HANDSHAKE,
    IPCBUS_TRANSPORT_RENDERER_COMMAND,
    IPCBUS_TRANSPORT_RENDERER_EVENT
} from '../renderer/IpcBusConnectorRenderer';
import { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusConnectorNet } from '../node/IpcBusConnectorNet';

class IpcBusBridgeConnectorClientNet implements IpcBusConnector.Client {
    protected _bridge: IpcBusBridgeImpl;

    constructor(bridge: IpcBusBridgeImpl) {
       this._bridge = bridge;
    }

    onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void {
        this._bridge._onNetMessageReceived(ipcBusCommand, ipcPacketBuffer);
    }

    onConnectorBufferReceived(__ignore__: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): void {
    }

    onConnectorClosed(): void {
    }
}

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusNetBridge implements IpcBusConnector.Client {
    private _connector: IpcBusConnectorNet;
    private _connectorClient: IpcBusBridgeConnectorClientNet;
    protected _subscriptions: IpcBusUtils.ChannelConnectionMap<Electron.WebContents>;
    protected _bridge: IpcBusBridgeImpl;

    constructor(contextType: Client.IpcBusProcessType, bridge: IpcBusBridgeImpl) {
        this._bridge = bridge;

        this._connector = new IpcBusConnectorNet(contextType);
        this._connectorClient = new IpcBusBridgeConnectorClientNet(this._bridge);
        this._connector.addClient(this._connectorClient);
        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<Electron.WebContents>('IPCBus:NetBridge', true);
    }

    hasChannel(channel: string): boolean {
        return this._subscriptions.hasChannel(channel);
    }

    hasRequestChannel(channel: string): boolean {
        return this._subscriptions.getRequestChannel(channel) != null;
    }

    connect(arg1: Bridge.IpcBusBridge.ConnectOptions | string | number, arg2?: Bridge.IpcBusBridge.ConnectOptions | string, arg3?: Bridge.IpcBusBridge.ConnectOptions): Promise<void> {
        const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
        return this._connector.ipcHandshake(options)
        .then(() => {

        });
    }

    close(options?: Bridge.IpcBusBridge.CloseOptions): Promise<void> {
        return this._connector.ipcShutdown(options);
    }

    onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void {
        if (this._subscriptions.hasChannel(ipcBusCommand.channel)) {
            this._connector.ipcPostBuffer(ipcPacketBuffer.buffer);
        }
    }

    onConnectorBufferReceived(__ignore__: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): void {
        if (this._subscriptions.hasChannel(ipcBusCommand.channel)) {
            this._connector.ipcPostBuffer(rawContent.buffer);
        }
    }
    
    onConnectorClosed(): void {
    }
}

