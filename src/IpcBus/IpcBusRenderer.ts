/// <reference types='node' />

import { EventEmitter } from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';
import {IpcBusCommonEventEmitter} from './IpcBusClient';
import {IpcBusCommonClient} from './IpcBusClient';

// Implementation for renderer process
/** @internal */
export class IpcBusRendererEventEmitter extends IpcBusCommonEventEmitter {
    private _ipcObj: any;
    private _lambda: Function;

    constructor() {
        super('Renderer');
    };

    private _onHandshake(eventOrPeerName: any, peerNameOrUndefined: any): void {
        // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
        if (eventOrPeerName instanceof EventEmitter) {
            this._peerName = peerNameOrUndefined;
            IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Standard listening for #${this._peerName}`);
            this._lambda = (eventOrTopic: any, topicOrPayload: any, payloadOrPeerName: any, peerNameOfReplyTopic: any, replyTopicOrUndefined?: any) => this._onDataReceived(topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic, replyTopicOrUndefined);
            this._ipcObj.on(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, this._lambda);
        } else {
            this._peerName = eventOrPeerName;
            IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Sandbox listening for #${this._peerName}`);
            this._lambda = (eventOrTopic: any, topicOrPayload: any, payloadOrPeerName: any, peerNameOfReplyTopic: any, replyTopicOrUndefined?: any) => this._onDataReceived(eventOrTopic, topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic);
            this._ipcObj.on(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, this._lambda);
        }

    };

    // Set API
    ipcConnect(connectHandler: IpcBusInterfaces.IpcBusConnectHandler): void {
        if (!this._ipcObj) {
            this._ipcObj = require('electron').ipcRenderer;
            this._ipcObj.once(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE, (eventOrPeerName: any, peerNameOrUndefined: any) => {
                this._onHandshake(eventOrPeerName, peerNameOrUndefined);
                this._ipcObj.once(IpcBusUtils.IPC_BUS_RENDERER_CONNECT, () => {
                    connectHandler();
                });
                this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_CONNECT);
            });
            this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE);
        }
        else {
            this._ipcObj.once(IpcBusUtils.IPC_BUS_RENDERER_CONNECT, () => {
                connectHandler();
            });
            this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_CONNECT);
        }
    }

    ipcClose(): void {
        if (this._ipcObj) {
            this._ipcObj.removeListener(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, this._lambda);
            this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_CLOSE);
            this._ipcObj = null;
        }
    }

    ipcSubscribe(topic: string, peerName: string): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_SUBSCRIBE, topic, this._peerName);
    }

    ipcUnsubscribe(topic: string, peerName: string): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_UNSUBSCRIBE, topic, this._peerName);
    }

    ipcSend(topic: string, data: Object | string, peerName: string): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_SEND, topic, data, this._peerName);
    }

    ipcRequest(topic: string, data: Object | string, peerName: string, replyTopic: string): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_REQUEST, topic, data, this._peerName, replyTopic);
    }

    ipcQueryBrokerState(topic: string, peerName: string): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_QUERYSTATE, topic, this._peerName);
    }
}


// Implementation of IpcBusClient for Renderer process
/** @internal */
export class IpcBusRendererClient extends IpcBusCommonClient {
     constructor() {
        super(new IpcBusRendererEventEmitter());
    }
}