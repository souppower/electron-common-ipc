/// <reference types='electron' />

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusTransportSingleImpl } from '../IpcBusTransportSingleImpl';
import { IpcBusPeer } from '../IpcBusClient';

export class IpcBusBridgeTransportNet extends IpcBusTransportSingleImpl {
    protected _bridge: IpcBusBridgeImpl;
    protected _subscriptions: IpcBusUtils.ChannelConnectionMap<string>;

    constructor(connector: IpcBusConnector, bridge: IpcBusBridgeImpl) {
        super(connector);

        this._bridge = bridge;
        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<string>('IPCBus:NetBridge', false);
    }

    get peer(): IpcBusPeer {
        return this._peer;
    }

    onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.AddChannelListener:
                this._subscriptions.addRef(ipcBusCommand.channel, 'netbroker', ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveChannelListener:
                this._subscriptions.release(ipcBusCommand.channel, 'netbroker', ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                this._subscriptions.releaseAll(ipcBusCommand.channel, 'netbroker', ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveListeners:
                this._subscriptions.removePeer('netbroker', ipcBusCommand.peer);
                break;

            default:
                this._bridge._onNetMessageReceived(ipcBusCommand, ipcPacketBuffer);
                break;
        }
    }

    onConnectorBufferReceived(__ignore__: any, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): void {
    }

    onConnectorClosed(): void {
    }

}

