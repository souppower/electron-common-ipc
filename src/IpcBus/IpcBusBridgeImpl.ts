import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusCommand } from './IpcBusCommand';
import { IpcBusTransportNode } from './IpcBusTransportNode';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeImpl extends IpcBusTransportNode implements IpcBusInterfaces.IpcBusBridge {
    private _ipcMain: any;
    private _ipcBusPeers: Map<string, IpcBusInterfaces.IpcBusPeer>;
    private _onRendererMessageBind: Function;

    protected _subscriptions: IpcBusUtils.ChannelConnectionMap<number>;
    protected _requestChannels: Map<string, any>;

//    _lambdaCleanUpHandler: Function;

    constructor(processType: IpcBusInterfaces.IpcBusProcessType, ipcOptions: IpcBusUtils.IpcOptions) {
        super(processType, ipcOptions);

        this._ipcMain = require('electron').ipcMain;

        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<number>('IPCBus:Bridge');
        this._requestChannels = new Map<string, any>();
        this._ipcBusPeers = new Map<string, IpcBusInterfaces.IpcBusPeer>();
        this._onRendererMessageBind = this._onRendererMessage.bind(this);
        // this._lambdaCleanUpHandler = (webContentsId: string) => {
        //     this.rendererCleanUp(webContentsId);
        // };
    }

    protected _onClose() {
        this._ipcBusPeers.clear();
        this._ipcMain.removeListener(IpcBusUtils.IPC_BUS_RENDERER_COMMAND, this._onRendererMessageBind);
    }

    // IpcBusBridge API
    start(options?: IpcBusInterfaces.IpcBusBridge.StartOptions): Promise<string> {
        options = options || {};
        if (options.timeoutDelay == null) {
            options.timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        let p = new Promise<string>((resolve, reject) => {
            this.ipcConnect({ peerName: `IpcBusBridge`, ...options } )
                .then((msg) => {
                    // Guard against people calling start several times
                    if (this._ipcMain.listenerCount(IpcBusUtils.IPC_BUS_RENDERER_COMMAND) === 0) {
                        this._ipcMain.addListener(IpcBusUtils.IPC_BUS_RENDERER_COMMAND, this._onRendererMessageBind);
                    }
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
                    resolve(msg);
                })
                .catch((err) => {
                    reject(err);
                });
        });
        return p;
    }

    stop() {
        this.ipcClose();
        this._ipcMain.removeListener(IpcBusUtils.IPC_BUS_RENDERER_COMMAND, this._onRendererMessageBind);
    }

    // Not exposed
    queryState(): Object {
        let queryStateResult: Object[] = [];
        this._subscriptions.forEach((connData, channel) => {
            connData.peerIds.forEach((peerIdRefCount) => {
                queryStateResult.push({ channel: channel, peer: this._ipcBusPeers.get(peerIdRefCount.peerId), count: peerIdRefCount.refCount });
            });
        });
        return queryStateResult;
    }

    protected _onEventReceived(ipcBusCommand: IpcBusCommand, args: any[]) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage:
            case IpcBusCommand.Kind.RequestMessage:
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
                    connData.conn.send(IpcBusUtils.IPC_BUS_RENDERER_EVENT, ipcBusCommand, args);
                });
                break;

            case IpcBusCommand.Kind.RequestResponse:
                const webContents = this._requestChannels.get(ipcBusCommand.data.replyChannel);
                if (webContents) {
                    this._requestChannels.delete(ipcBusCommand.data.replyChannel);
                    webContents.send(IpcBusUtils.IPC_BUS_RENDERER_EVENT, ipcBusCommand, args);
                }
                break;
        }
    }

    private _rendererCleanUp(webContents: Electron.WebContents, webContentsId: number, peerId: string): void {
        this._subscriptions.releaseConnection(webContentsId);
        // ForEach is supposed to support deletion during the iteration !
        this._requestChannels.forEach((webContentsForRequest, channel) => {
            if (webContentsForRequest === webContents) {
                this._requestChannels.delete(channel);
            }
        });
    }

    private _onConnect(webContents: Electron.WebContents, ipcBusPeer: IpcBusInterfaces.IpcBusPeer): void {
        this._ipcBusPeers.set(ipcBusPeer.id, ipcBusPeer);

        // Have to closure the webContentsId as webContents.id is undefined when destroyed !!!
        this._completePeerInfo(webContents, ipcBusPeer);
        let webContentsId = webContents.id;
        webContents.addListener('destroyed', () => {
            this._rendererCleanUp(webContents, webContentsId, ipcBusPeer.id);
            // Simulate the close message
            if (this._ipcBusPeers.delete(ipcBusPeer.id)) {
                this._ipcPushCommand({ kind: IpcBusCommand.Kind.Disconnect, channel: '', peer: ipcBusPeer });
            }
        });
        // webContents.addListener('destroyed', this._lambdaCleanUpHandler);
    }

    private _completePeerInfo(webContents: Electron.WebContents, ipcBusPeer: IpcBusInterfaces.IpcBusPeer): void {
        let peerName = `${ipcBusPeer.process.type}-${webContents.id}`;
        ipcBusPeer.process.wcid = webContents.id;
        // Hidden function, may disappear
        try {
            ipcBusPeer.process.rid = (webContents as any).getProcessId();
            peerName += `-r${ipcBusPeer.process.rid}`;
        }
        catch (err) {
            ipcBusPeer.process.rid = -1;
        }
        // >= Electron 1.7.1
        try {
            ipcBusPeer.process.pid = webContents.getOSProcessId();
            peerName += `_${ipcBusPeer.process.pid}`;
        }
        catch (err) {
            ipcBusPeer.process.pid = webContents.id;
        }
        ipcBusPeer.name = peerName;
    }

    protected _onRendererMessage(event: any, ipcBusCommand: IpcBusCommand, args: any[]) {
        const webContents = event.sender;
        const ipcBusPeer = ipcBusCommand.peer;
        const ipcBusData = ipcBusCommand.data;
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.Connect :
                this._onConnect(webContents, ipcBusPeer);
                ipcBusPeer.name = args[0] || ipcBusPeer.name;
                // We get back to the webContents
                // - to confirm the connection
                // - to provide peerName and id/s

                // BEWARE, if the message is sent before webContents is ready, it will be lost !!!!
                if (webContents.getURL() && !webContents.isLoadingMainFrame()) {
                    webContents.send(IpcBusUtils.IPC_BUS_RENDERER_CONNECT, ipcBusPeer);
                    this._ipcPushCommand(ipcBusCommand, args);
                }
                else {
                    webContents.on('did-finish-load', () => {
                        webContents.send(IpcBusUtils.IPC_BUS_RENDERER_CONNECT, ipcBusPeer);
                        this._ipcPushCommand(ipcBusCommand, args);
                    });
                }
                // WARNING, this 'return' is on purpose.
                return;

            case IpcBusCommand.Kind.Disconnect :
            case IpcBusCommand.Kind.Close :
                // We do not close the socket, we just disconnect a peer
                ipcBusCommand.kind = IpcBusCommand.Kind.Disconnect;
                this._rendererCleanUp(webContents, webContents.id, ipcBusPeer.id);
                this._ipcBusPeers.delete(ipcBusPeer.id);
                break;

            case IpcBusCommand.Kind.AddChannelListener :
                this._subscriptions.addRef(ipcBusCommand.channel, webContents.id, webContents, ipcBusPeer.id);
                break;

            case IpcBusCommand.Kind.RemoveChannelAllListeners :
                this._subscriptions.releaseAll(ipcBusCommand.channel, webContents.id, ipcBusPeer.id);
                break;

            case IpcBusCommand.Kind.RemoveChannelListener :
                this._subscriptions.release(ipcBusCommand.channel, webContents.id, ipcBusPeer.id);
                break;

            case IpcBusCommand.Kind.RemoveListeners :
                this._rendererCleanUp(webContents, webContents.id, ipcBusPeer.id);
                break;

            case IpcBusCommand.Kind.RequestMessage :
                this._requestChannels.set(ipcBusData.replyChannel, webContents);
                break;

            case IpcBusCommand.Kind.RequestCancel :
                this._requestChannels.delete(ipcBusData.replyChannel);
                break;

            default :
                break;
        }
        this._ipcPushCommand(ipcBusCommand, args);
    }
}

