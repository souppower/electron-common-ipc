import * as Client from '../IpcBusClient';
import * as IpcBusUtils from '../IpcBusUtils';

import { IpcBusTransportBridge } from './IpcBusTransportBridge';
import { IpcBusTransportNet } from '../node/IpcBusTransportNet';
import { IpcBusClientImpl}  from '../IpcBusClientImpl';

class IpcBusClientBridge extends IpcBusClientImpl {
    connect(arg1: Client.IpcBusClient.ConnectOptions | string | number, arg2?: Client.IpcBusClient.ConnectOptions | string, arg3?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
        const peer = this._transport.peer;
        this._transport.ipcClose();
        this._transport.ipcCallback = null;
        if ((options.port == null) || (options.path == null)) {
            this._transport = new IpcBusTransportBridge(peer.process.type);
        }
        else {
            this._transport = new IpcBusTransportNet(peer.process.type);
        }
        this._transport.ipcCallback((channel, ipcBusEvent, ...args) => {
            super._eventEmitterEmit(channel, ipcBusEvent, ...args);
        });
        return this._transport.ipcConnect({ peerName: options.peerName || peer.name, ...options });
    }
}

// Implementation for Electron Main process
export function Create(contextType: Client.IpcBusProcessType): Client.IpcBusClient {
    const transport = new IpcBusTransportBridge(contextType);
    const ipcClient = new IpcBusClientBridge(transport);
    // const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
