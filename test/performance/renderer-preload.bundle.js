(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid = require("uuid");
const events_1 = require("events");
const IpcBusTransportWindow_1 = require("./IpcBusTransportWindow");
const CrossFrameMessage_1 = require("./CrossFrameMessage");
const trace = false;
class CrossFrameEventEmitter extends events_1.EventEmitter {
    constructor(target, origin) {
        super();
        this._target = target;
        this._origin = origin || '*';
        this._uuid = uuid.v4();
        this._messageHandler = this._messageHandler.bind(this);
        this._start();
        if (trace) {
            this.on('newListener', (event) => {
                trace && console.log(`CFEE ${this._uuid} - newListener ${event}`);
            });
            this.on('removeListener', (event) => {
                trace && console.log(`CFEE ${this._uuid} - removeListener ${event}`);
            });
        }
        window.addEventListener('unload', () => {
            trace && console.log(`CFEE ${this._uuid} - unload event`);
            this.close();
        });
    }
    _start() {
        if (this._messageChannel == null) {
            trace && console.log(`CFEE ${this._uuid} - init`);
            this._messageChannel = new MessageChannel();
            this._messageChannel.port1.addEventListener('message', this._messageHandler);
            this._messageChannel.port1.start();
            const packet = CrossFrameMessage_1.CrossFrameMessage.Encode(this._uuid, 'init', []);
            this._target.postMessage(packet, this._origin, [this._messageChannel.port2]);
        }
    }
    close() {
        if (this._messageChannel != null) {
            trace && console.log(`CFEE ${this._uuid} - exit`);
            const packet = CrossFrameMessage_1.CrossFrameMessage.Encode(this._uuid, 'exit', []);
            this._target.postMessage(packet, this._origin);
            this._messageChannel.port1.removeEventListener('message', this._messageHandler);
            this._messageChannel.port1.close();
            this._messageChannel = null;
        }
    }
    send(channel, ...args) {
        trace && console.log(`CFEE ${this._uuid} - send: ${channel} - ${JSON.stringify(args)}`);
        const packet = CrossFrameMessage_1.CrossFrameMessage.Encode(this._uuid, channel, args);
        this._messageChannel.port1.postMessage(packet);
    }
    _eventHandler(channel, ...args) {
        trace && console.log(`CFEE ${this._uuid} - emit: ${channel} - ${JSON.stringify(args)} => ${this.listenerCount(channel)}`);
        this.emit(channel, ...args);
    }
    _messageHandler(event) {
        trace && console.log(`CFEE ${this._uuid} - messageHandler: ${JSON.stringify(event)}`);
        const packet = CrossFrameMessage_1.CrossFrameMessage.Decode(event.data);
        if (packet) {
            if (Array.isArray(packet.args)) {
                this._eventHandler(packet.channel, ...packet.args);
            }
            else {
                this._eventHandler(packet.channel);
            }
        }
    }
}
exports.CrossFrameEventEmitter = CrossFrameEventEmitter;
class CrossFrameEventDispatcher {
    constructor(target) {
        this._target = target;
        this._lifecycleHandler = this._lifecycleHandler.bind(this);
        this._messageHandler = this._messageHandler.bind(this);
        this._started = false;
    }
    start() {
        if (this._started === false) {
            trace && console.log(`CFEDisp ${this._uuid} - start`);
            this._started = true;
            this._uuid = uuid.v4();
            this._ports = new Map();
            const target = this._target;
            if (target.addEventListener) {
                target.addEventListener('message', this._lifecycleHandler);
            }
            else if (target.attachEvent) {
                target.attachEvent('onmessage', this._lifecycleHandler);
            }
        }
    }
    stop() {
        if (this._started) {
            trace && console.log(`CFEDisp ${this._uuid} - stop`);
            this._started = false;
            const target = this._target;
            if (target.addEventListener) {
                target.removeEventListener('message', this._lifecycleHandler);
            }
            else if (target.attachEvent) {
                target.detachEvent('onmessage', this._lifecycleHandler);
            }
            this._ports.forEach((port) => {
                port.removeEventListener('message', this._messageHandler);
                port.close();
            });
            this._ports.clear();
            this._ports = null;
        }
    }
    _lifecycleHandler(event) {
        const packet = CrossFrameMessage_1.CrossFrameMessage.Decode(event.data);
        trace && console.log(`CFEDisp ${this._uuid} - lifecycle - ${JSON.stringify(packet)}`);
        if (packet) {
            if (packet.channel === 'init') {
                trace && console.log(`CFEDisp ${this._uuid} - lifecycle - init ${packet.uuid}`);
                let port = this._ports.get(packet.uuid);
                if (port == null) {
                    port = event.ports[0];
                    this._ports.set(packet.uuid, port);
                    port.addEventListener('message', this._messageHandler);
                    port.start();
                }
            }
            else if (packet.channel === 'exit') {
                trace && console.log(`CFEDisp ${this._uuid} - lifecycle - exit ${packet.uuid}`);
                let port = this._ports.get(packet.uuid);
                if (port) {
                    this._ports.delete(packet.uuid);
                    port.removeEventListener('message', this._messageHandler);
                    port.close();
                }
            }
        }
    }
    _messageHandler(event) {
        trace && console.log(`CFEDisp ${this._uuid} - messageHandler ${JSON.stringify(event)}`);
        const packet = CrossFrameMessage_1.CrossFrameMessage.Decode(event.data);
        if (packet) {
            trace && console.log(`CFEDisp ${this._uuid} - messageHandler - ${packet}`);
            this._ports.forEach((port, uuid) => {
                if (uuid !== packet.uuid) {
                    port.postMessage(event.data);
                }
            });
        }
    }
}
exports.CrossFrameEventDispatcher = CrossFrameEventDispatcher;
class IpcBusFrameBridge extends CrossFrameEventDispatcher {
    constructor(ipcWindow, target) {
        super(target);
        this._ipcWindow = ipcWindow;
        this._messageTransportHandlerEvent = this._messageTransportHandlerEvent.bind(this);
        this._messageTransportHandlerConnect = this._messageTransportHandlerConnect.bind(this);
    }
    start() {
        super.start();
        this._ipcWindow.addListener(IpcBusTransportWindow_1.IPCBUS_TRANSPORT_RENDERER_CONNECT, this._messageTransportHandlerConnect);
        this._ipcWindow.addListener(IpcBusTransportWindow_1.IPCBUS_TRANSPORT_RENDERER_EVENT, this._messageTransportHandlerEvent);
    }
    stop() {
        this._ipcWindow.removeListener(IpcBusTransportWindow_1.IPCBUS_TRANSPORT_RENDERER_CONNECT, this._messageTransportHandlerConnect);
        this._ipcWindow.removeListener(IpcBusTransportWindow_1.IPCBUS_TRANSPORT_RENDERER_EVENT, this._messageTransportHandlerEvent);
        super.stop();
    }
    _messageHandler(event) {
        const packet = CrossFrameMessage_1.CrossFrameMessage.Decode(event.data);
        trace && console.log(`IpcBusFrameBridge - messageHandler - ${JSON.stringify(packet)}`);
        if (packet) {
            if (Array.isArray(packet.args)) {
                this._ipcWindow.send(packet.channel, ...packet.args);
            }
            else {
                this._ipcWindow.send(packet.channel);
            }
        }
    }
    _messageTransportHandlerEvent(...args) {
        trace && console.log(`_messageTransportHandlerEvent ${JSON.stringify(args)}`);
        const packet = CrossFrameMessage_1.CrossFrameMessage.Encode('dispatcher', IpcBusTransportWindow_1.IPCBUS_TRANSPORT_RENDERER_EVENT, args);
        this._ports.forEach((port) => {
            port.postMessage(packet);
        });
    }
    _messageTransportHandlerConnect(...args) {
        trace && console.log(`_messageTransportHandlerConnect ${JSON.stringify(args)}`);
        const packet = CrossFrameMessage_1.CrossFrameMessage.Encode('dispatcher', IpcBusTransportWindow_1.IPCBUS_TRANSPORT_RENDERER_CONNECT, args);
        this._ports.forEach((port) => {
            port.postMessage(packet);
        });
    }
}
exports.IpcBusFrameBridge = IpcBusFrameBridge;

},{"./CrossFrameMessage":2,"./IpcBusTransportWindow":10,"events":25,"uuid":38}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const json_helpers_1 = require("json-helpers");
var CrossFrameMessage;
(function (CrossFrameMessage) {
    CrossFrameMessage.CrossFrameKeyId = '__cross-frame-message__';
    function Decode(data) {
        try {
            const wrap = json_helpers_1.JSONParser.parse(data);
            const packet = wrap[CrossFrameMessage.CrossFrameKeyId];
            if (packet) {
                return packet;
            }
        }
        catch (e) {
        }
        return null;
    }
    CrossFrameMessage.Decode = Decode;
    function Encode(uuid, channel, args) {
        const wrap = {
            [CrossFrameMessage.CrossFrameKeyId]: {
                uuid,
                channel,
                args: args
            }
        };
        return json_helpers_1.JSONParser.stringify(wrap);
    }
    CrossFrameMessage.Encode = Encode;
})(CrossFrameMessage = exports.CrossFrameMessage || (exports.CrossFrameMessage = {}));

},{"json-helpers":30}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IpcBusClient_1 = require("./IpcBusClient");
exports.CreateIpcBusClient = () => {
    const windowLocal = window;
    if (windowLocal.ElectronCommonIpc && windowLocal.ElectronCommonIpc.CreateIpcBusClient) {
        return windowLocal.ElectronCommonIpc.CreateIpcBusClient();
    }
    return null;
};
IpcBusClient_1.IpcBusClient.Create = exports.CreateIpcBusClient;

},{"./IpcBusClient":4}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPCBUS_CHANNEL = '/electron-ipc-bus';
exports.IPCBUS_CHANNEL_QUERY_STATE = `${exports.IPCBUS_CHANNEL}/queryState`;
exports.ELECTRON_IPC_BROKER_LOGPATH_ENV_VAR = 'ELECTRON_IPC_BROKER_LOGPATH';
exports.ELECTRON_IPC_BRIDGE_LOGPATH_ENV_VAR = 'ELECTRON_IPC_BRIDGE_LOGPATH';
var IpcBusBrokerOwner;
(function (IpcBusBrokerOwner) {
    IpcBusBrokerOwner[IpcBusBrokerOwner["Bridge"] = 0] = "Bridge";
    IpcBusBrokerOwner[IpcBusBrokerOwner["Broker"] = 1] = "Broker";
})(IpcBusBrokerOwner = exports.IpcBusBrokerOwner || (exports.IpcBusBrokerOwner = {}));
var IpcBusClient;
(function (IpcBusClient) {
})(IpcBusClient = exports.IpcBusClient || (exports.IpcBusClient = {}));

},{}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const IpcBusCommand_1 = require("./IpcBusCommand");
const IpcBusUtils = require("./IpcBusUtils");
class IpcBusClientImpl extends events_1.EventEmitter {
    constructor(ipcBusClientTransport) {
        super();
        super.setMaxListeners(0);
        this._transport = ipcBusClientTransport;
        this._transport.ipcCallback((channel, ipcBusEvent, ...args) => {
            super.emit(channel, ipcBusEvent, ...args);
        });
    }
    get peer() {
        return this._transport.peer;
    }
    connect(arg1, arg2, arg3) {
        const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
        return this._transport.ipcConnect(options);
    }
    close(options) {
        super.removeAllListeners();
        return this._transport.ipcClose(options);
    }
    send(channel, ...args) {
        this._transport.ipcSend(IpcBusCommand_1.IpcBusCommand.Kind.SendMessage, channel, undefined, args);
    }
    request(channel, timeoutDelay, ...args) {
        return this._transport.ipcRequest(channel, timeoutDelay, args);
    }
    emit(event, ...args) {
        this._transport.ipcSend(IpcBusCommand_1.IpcBusCommand.Kind.SendMessage, event, undefined, args);
        return true;
    }
    addListener(channel, listener) {
        super.addListener(channel, listener);
        this._transport.ipcSend(IpcBusCommand_1.IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }
    removeListener(channel, listener) {
        super.removeListener(channel, listener);
        this._transport.ipcSend(IpcBusCommand_1.IpcBusCommand.Kind.RemoveChannelListener, channel);
        return this;
    }
    on(channel, listener) {
        return this.addListener(channel, listener);
    }
    once(channel, listener) {
        super.once(channel, listener);
        this._transport.ipcSend(IpcBusCommand_1.IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }
    off(channel, listener) {
        return this.removeListener(channel, listener);
    }
    removeAllListeners(channel) {
        super.removeAllListeners(channel);
        if (channel) {
            this._transport.ipcSend(IpcBusCommand_1.IpcBusCommand.Kind.RemoveChannelAllListeners, channel);
        }
        else {
            this._transport.ipcSend(IpcBusCommand_1.IpcBusCommand.Kind.RemoveListeners, '');
        }
        return this;
    }
    prependListener(channel, listener) {
        super.prependListener(channel, listener);
        this._transport.ipcSend(IpcBusCommand_1.IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }
    prependOnceListener(channel, listener) {
        super.prependOnceListener(channel, listener);
        this._transport.ipcSend(IpcBusCommand_1.IpcBusCommand.Kind.AddChannelListener, channel);
        return this;
    }
}
exports.IpcBusClientImpl = IpcBusClientImpl;

},{"./IpcBusCommand":7,"./IpcBusUtils":11,"events":25}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IpcBusTransportWindow_1 = require("./IpcBusTransportWindow");
const IpcBusClientImpl_1 = require("./IpcBusClientImpl");
function Create(contextType, ipcWindow) {
    const transport = new IpcBusTransportWindow_1.IpcBusTransportWindow(contextType, ipcWindow);
    const ipcClient = new IpcBusClientImpl_1.IpcBusClientImpl(transport);
    return ipcClient;
}
exports.Create = Create;

},{"./IpcBusClientImpl":5,"./IpcBusTransportWindow":10}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var IpcBusCommand;
(function (IpcBusCommand) {
    let Kind;
    (function (Kind) {
        Kind["Connect"] = "COO";
        Kind["Disconnect"] = "COD";
        Kind["Close"] = "COC";
        Kind["AddChannelListener"] = "LICA";
        Kind["RemoveChannelListener"] = "LICR";
        Kind["RemoveChannelAllListeners"] = "LICRA";
        Kind["RemoveListeners"] = "LIR";
        Kind["SendMessage"] = "MES";
        Kind["RequestMessage"] = "RQM";
        Kind["RequestResponse"] = "RQR";
        Kind["RequestCancel"] = "RQC";
        Kind["BridgeConnect"] = "BCOO";
        Kind["BridgeDisconnect"] = "BCOD";
        Kind["BridgeClose"] = "BCOC";
        Kind["BridgeAddChannelListener"] = "BLICA";
        Kind["BridgeRemoveChannelListener"] = "BLICR";
        Kind["BridgeRemoveChannelAllListeners"] = "BLICRA";
        Kind["BridgeRemoveListeners"] = "BLIR";
        Kind["BridgeSendMessage"] = "BMES";
        Kind["BridgeRequestMessage"] = "BRQM";
        Kind["BridgeRequestResponse"] = "BRQR";
        Kind["BridgeRequestCancel"] = "BRQC";
        Kind["BrokerAddChannels"] = "BOCAS";
        Kind["BrokerRemoveChannels"] = "BOCRS";
        Kind["BridgeAddChannels"] = "BICAS";
        Kind["BridgeRemoveChannels"] = "BICRS";
    })(Kind = IpcBusCommand.Kind || (IpcBusCommand.Kind = {}));
    ;
})(IpcBusCommand = exports.IpcBusCommand || (exports.IpcBusCommand = {}));

},{}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IpcBusClientWindow_1 = require("./IpcBusClientWindow");
const CrossFrameEventEmitter2_1 = require("./CrossFrameEventEmitter2");
const trace = false;
function PreloadElectronCommonIpcAutomatic() {
    return _PreloadElectronCommonIpc('Implicit');
}
exports.PreloadElectronCommonIpcAutomatic = PreloadElectronCommonIpcAutomatic;
function PreloadElectronCommonIpc(iframeSupport = false) {
    return _PreloadElectronCommonIpc('Explicit', iframeSupport);
}
exports.PreloadElectronCommonIpc = PreloadElectronCommonIpc;
function _PreloadElectronCommonIpc(context, iframeSupport = false) {
    const windowLocal = window;
    if (windowLocal.self === windowLocal.top) {
        try {
            const electron = require('electron');
            if (electron && electron.ipcRenderer) {
                windowLocal.ElectronCommonIpc = windowLocal.ElectronCommonIpc || {};
                if (windowLocal.ElectronCommonIpc.CreateIpcBusClient == null) {
                    trace && console.log(`inject - ${context} - ElectronCommonIpc.CreateIpcBusClient`);
                    windowLocal.ElectronCommonIpc.CreateIpcBusClient = () => {
                        trace && console.log(`${context} - ElectronCommonIpc.CreateIpcBusClient`);
                        const ipcBusClient = IpcBusClientWindow_1.Create('renderer', electron.ipcRenderer);
                        return ipcBusClient;
                    };
                }
                if (windowLocal.ElectronCommonIpc.FrameBridge == null) {
                    trace && console.log(`inject - ${context} - ElectronCommonIpc.FrameBridge`);
                    windowLocal.ElectronCommonIpc.FrameBridge = new CrossFrameEventEmitter2_1.IpcBusFrameBridge(electron.ipcRenderer, window);
                }
            }
        }
        catch (_) {
        }
        try {
            const frameBridge = windowLocal.ElectronCommonIpc && windowLocal.ElectronCommonIpc.FrameBridge;
            if (frameBridge) {
                if (iframeSupport) {
                    trace && console.log(`${context} - ElectronCommonIpc.FrameBridge - start`);
                    frameBridge.start();
                }
                else {
                    frameBridge.stop();
                    trace && console.log(`${context} - ElectronCommonIpc.FrameBridge - stop`);
                }
            }
        }
        catch (_) {
        }
    }
    else {
        try {
            windowLocal.ElectronCommonIpc = windowLocal.ElectronCommonIpc || {};
            if (windowLocal.ElectronCommonIpc.CreateIpcBusClient == null) {
                trace && console.log(`${context} - Frame ElectronCommonIpc`);
                const crossFrameEE = new CrossFrameEventEmitter2_1.CrossFrameEventEmitter(window.parent);
                windowLocal.ElectronCommonIpc.CreateIpcBusClient = () => {
                    trace && console.log(`${context} - Frame ElectronCommonIpc.CreateIpcBusClient`);
                    const ipcBusClient = IpcBusClientWindow_1.Create('renderer-frame', crossFrameEE);
                    return ipcBusClient;
                };
            }
        }
        catch (_) {
        }
    }
    return IsElectronCommonIpcAvailable();
}
function IsElectronCommonIpcAvailable() {
    try {
        const windowLocal = window;
        return (windowLocal.ElectronCommonIpc && windowLocal.ElectronCommonIpc.CreateIpcBusClient) != null;
    }
    catch (_) {
    }
    return false;
}
exports.IsElectronCommonIpcAvailable = IsElectronCommonIpcAvailable;

},{"./CrossFrameEventEmitter2":1,"./IpcBusClientWindow":6,"electron":"electron"}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid = require("uuid");
const Client = require("./IpcBusClient");
const IpcBusUtils = require("./IpcBusUtils");
const IpcBusCommand_1 = require("./IpcBusCommand");
const replyChannelPrefix = `${Client.IPCBUS_CHANNEL}/request-`;
const v1IdPattern = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
function extractPeerIdFromReplyChannel(replyChannel) {
    return replyChannel.substr(replyChannelPrefix.length, v1IdPattern.length);
}
exports.extractPeerIdFromReplyChannel = extractPeerIdFromReplyChannel;
class DeferredRequest {
    constructor(channel) {
        this._channel = channel;
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });
    }
    fulFilled(ipcBusCommand, args) {
        const ipcBusEvent = { channel: this._channel, sender: ipcBusCommand.peer };
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Peer #${ipcBusEvent.sender.name} replied to request on ${ipcBusCommand.request.replyChannel}`);
        if (ipcBusCommand.request.resolve) {
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] resolve`);
            const response = { event: ipcBusEvent, payload: args[0] };
            this.resolve(response);
        }
        else if (ipcBusCommand.request.reject) {
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject`);
            const response = { event: ipcBusEvent, err: args[0] };
            this.reject(response);
        }
        else {
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject: unknown format`);
            const response = { event: ipcBusEvent, err: 'unknown format' };
            this.reject(response);
        }
    }
    ;
}
class IpcBusTransportImpl {
    constructor(ipcBusContext) {
        this._ipcBusPeer = { id: uuid.v1(), name: '', process: ipcBusContext };
        this._requestFunctions = new Map();
        this._requestNumber = 0;
    }
    get peer() {
        return this._ipcBusPeer;
    }
    generateReplyChannel() {
        ++this._requestNumber;
        return `${replyChannelPrefix}${this._ipcBusPeer.id}-${this._requestNumber.toString()}`;
    }
    ipcCallback(callback) {
        this._ipcCallback = callback;
    }
    _onCommandSendMessage(ipcBusCommand, args) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
        const ipcBusEvent = { channel: ipcBusCommand.channel, sender: ipcBusCommand.peer };
        this._ipcCallback(ipcBusCommand.channel, ipcBusEvent, ...args);
    }
    _onCommandRequestdMessage(ipcBusCommand, args) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
        const ipcBusEvent = { channel: ipcBusCommand.channel, sender: ipcBusCommand.peer };
        ipcBusEvent.request = {
            resolve: (payload) => {
                ipcBusCommand.request.resolve = true;
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Resolve request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - payload: ${JSON.stringify(payload)}`);
                this.ipcSend(IpcBusCommand_1.IpcBusCommand.Kind.RequestResponse, ipcBusCommand.request.replyChannel, ipcBusCommand.request, [payload]);
            },
            reject: (err) => {
                ipcBusCommand.request.reject = true;
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Reject request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} - err: ${JSON.stringify(err)}`);
                this.ipcSend(IpcBusCommand_1.IpcBusCommand.Kind.RequestResponse, ipcBusCommand.request.replyChannel, ipcBusCommand.request, [err]);
            }
        };
        this._ipcCallback(ipcBusCommand.channel, ipcBusEvent, ...args);
    }
    _onCommandRequestResponse(ipcBusCommand, args) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.request.replyChannel}')`);
        const deferredRequest = this._requestFunctions.get(ipcBusCommand.request.replyChannel);
        if (deferredRequest) {
            this._requestFunctions.delete(ipcBusCommand.request.replyChannel);
            deferredRequest.fulFilled(ipcBusCommand, args);
        }
    }
    _onCommandReceived(ipcBusCommand, ipcPacketBuffer) {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand_1.IpcBusCommand.Kind.BridgeSendMessage:
            case IpcBusCommand_1.IpcBusCommand.Kind.SendMessage: {
                const args = ipcPacketBuffer.parseArrayAt(1);
                this._onCommandSendMessage(ipcBusCommand, args);
                break;
            }
            case IpcBusCommand_1.IpcBusCommand.Kind.BridgeRequestMessage:
            case IpcBusCommand_1.IpcBusCommand.Kind.RequestMessage: {
                const args = ipcPacketBuffer.parseArrayAt(1);
                this._onCommandRequestdMessage(ipcBusCommand, args);
                break;
            }
            case IpcBusCommand_1.IpcBusCommand.Kind.BridgeRequestResponse:
            case IpcBusCommand_1.IpcBusCommand.Kind.RequestResponse: {
                const args = ipcPacketBuffer.parseArrayAt(1);
                this._onCommandRequestResponse(ipcBusCommand, args);
                break;
            }
        }
    }
    ipcRequest(channel, timeoutDelay, args) {
        if (timeoutDelay == null) {
            timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        const ipcBusCommandRequest = { channel, replyChannel: this.generateReplyChannel() };
        const deferredRequest = new DeferredRequest(channel);
        this._requestFunctions.set(ipcBusCommandRequest.replyChannel, deferredRequest);
        this.ipcSend(IpcBusCommand_1.IpcBusCommand.Kind.RequestMessage, channel, ipcBusCommandRequest, args);
        if (timeoutDelay >= 0) {
            setTimeout(() => {
                if (this._requestFunctions.delete(ipcBusCommandRequest.replyChannel)) {
                    this.ipcSend(IpcBusCommand_1.IpcBusCommand.Kind.RequestCancel, channel, ipcBusCommandRequest);
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject: timeout`);
                    const response = { event: { channel: channel, sender: this._ipcBusPeer }, err: 'timeout' };
                    deferredRequest.reject(response);
                }
            }, timeoutDelay);
        }
        return deferredRequest.promise;
    }
    ipcSend(kind, channel, ipcBusCommandRequest, args) {
        this.ipcPostCommand({ kind, channel, peer: this.peer, request: ipcBusCommandRequest }, args);
    }
}
exports.IpcBusTransportImpl = IpcBusTransportImpl;

},{"./IpcBusClient":4,"./IpcBusCommand":7,"./IpcBusUtils":11,"uuid":38}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const IpcBusUtils = require("./IpcBusUtils");
const IpcBusTransportImpl_1 = require("./IpcBusTransportImpl");
const IpcBusCommand_1 = require("./IpcBusCommand");
exports.IPCBUS_TRANSPORT_RENDERER_CONNECT = 'IpcBusRenderer:Connect';
exports.IPCBUS_TRANSPORT_RENDERER_COMMAND = 'IpcBusRenderer:Command';
exports.IPCBUS_TRANSPORT_RENDERER_EVENT = 'IpcBusRenderer:Event';
class IpcBusTransportWindow extends IpcBusTransportImpl_1.IpcBusTransportImpl {
    constructor(contextType, ipcWindow) {
        assert(contextType === 'renderer' || contextType === 'renderer-frame', `IpcBusTransportWindow: contextType must not be a ${contextType}`);
        super({ type: contextType, pid: -1 });
        this._ipcWindow = ipcWindow;
    }
    _reset() {
        this._promiseConnected = null;
        if (this._connected) {
            if (this._onIpcEventReceived) {
                this._ipcWindow.removeListener(exports.IPCBUS_TRANSPORT_RENDERER_EVENT, this._onIpcEventReceived);
            }
            this._connected = false;
        }
    }
    _onConnect(eventOrPeer, peerOrUndefined) {
        if (peerOrUndefined) {
            if (peerOrUndefined.id === this._ipcBusPeer.id) {
                this._ipcBusPeer = peerOrUndefined;
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport:Window] Activate Standard listening for #${this._ipcBusPeer.name}`);
                this._onIpcEventReceived = (eventEmitter, ipcBusCommand, args) => {
                    switch (ipcBusCommand.kind) {
                        case IpcBusCommand_1.IpcBusCommand.Kind.SendMessage: {
                            this._onCommandSendMessage(ipcBusCommand, args);
                            break;
                        }
                        case IpcBusCommand_1.IpcBusCommand.Kind.RequestMessage: {
                            this._onCommandRequestdMessage(ipcBusCommand, args);
                            break;
                        }
                        case IpcBusCommand_1.IpcBusCommand.Kind.RequestResponse: {
                            this._onCommandRequestResponse(ipcBusCommand, args);
                            break;
                        }
                    }
                };
                this._ipcWindow.addListener(exports.IPCBUS_TRANSPORT_RENDERER_EVENT, this._onIpcEventReceived);
                return true;
            }
        }
        else {
            if (eventOrPeer.id === this._ipcBusPeer.id) {
                this._ipcBusPeer = eventOrPeer;
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport:Window] Activate Sandbox listening for #${this._ipcBusPeer.name}`);
                this._onIpcEventReceived = (ipcBusCommand, args) => {
                    switch (ipcBusCommand.kind) {
                        case IpcBusCommand_1.IpcBusCommand.Kind.SendMessage: {
                            this._onCommandSendMessage(ipcBusCommand, args);
                            break;
                        }
                        case IpcBusCommand_1.IpcBusCommand.Kind.RequestMessage: {
                            this._onCommandRequestdMessage(ipcBusCommand, args);
                            break;
                        }
                        case IpcBusCommand_1.IpcBusCommand.Kind.RequestResponse: {
                            this._onCommandRequestResponse(ipcBusCommand, args);
                            break;
                        }
                    }
                };
                this._ipcWindow.addListener(exports.IPCBUS_TRANSPORT_RENDERER_EVENT, this._onIpcEventReceived);
                return true;
            }
        }
        return false;
    }
    ;
    ipcConnect(options) {
        let p = this._promiseConnected;
        if (!p) {
            options = IpcBusUtils.CheckConnectOptions(options);
            p = this._promiseConnected = new Promise((resolve, reject) => {
                let timer;
                const onIpcConnect = (eventOrPeer, peerOrUndefined) => {
                    if (this._connected) {
                        if (this._onConnect(eventOrPeer, peerOrUndefined)) {
                            this._ipcWindow.removeListener(exports.IPCBUS_TRANSPORT_RENDERER_CONNECT, onIpcConnect);
                            clearTimeout(timer);
                            resolve();
                        }
                    }
                    else {
                        this._ipcWindow.removeListener(exports.IPCBUS_TRANSPORT_RENDERER_CONNECT, onIpcConnect);
                        reject('cancelled');
                    }
                };
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        timer = null;
                        this._ipcWindow.removeListener(exports.IPCBUS_TRANSPORT_RENDERER_CONNECT, onIpcConnect);
                        this._reset();
                        reject('timeout');
                    }, options.timeoutDelay);
                }
                this._connected = true;
                this._ipcWindow.addListener(exports.IPCBUS_TRANSPORT_RENDERER_CONNECT, onIpcConnect);
                this.ipcSend(IpcBusCommand_1.IpcBusCommand.Kind.Connect, '', undefined, [options.peerName]);
            });
        }
        return p;
    }
    ipcClose(options) {
        if (this._connected) {
            this.ipcSend(IpcBusCommand_1.IpcBusCommand.Kind.Close, '');
            this._reset();
        }
        return Promise.resolve();
    }
    ipcPostCommand(ipcBusCommand, args) {
        if (this._connected) {
            ipcBusCommand.kind = ('B' + ipcBusCommand.kind);
            this._ipcWindow.send(exports.IPCBUS_TRANSPORT_RENDERER_COMMAND, ipcBusCommand, args);
        }
    }
}
exports.IpcBusTransportWindow = IpcBusTransportWindow;

},{"./IpcBusCommand":7,"./IpcBusTransportImpl":9,"./IpcBusUtils":11,"assert":19}],11:[function(require,module,exports){
(function (Buffer,process){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
exports.IPC_BUS_TIMEOUT = 20000;
const win32prefix1 = '\\\\.\\pipe';
const win32prefix2 = '\\\\?\\pipe';
function CleanPipeName(str) {
    if (process.platform === 'win32') {
        if ((str.lastIndexOf(win32prefix1, 0) === -1) && (str.lastIndexOf(win32prefix2, 0) === -1)) {
            str = str.replace(/^\//, '');
            str = str.replace(/\//g, '-');
            str = win32prefix1 + '\\' + str;
        }
    }
    return str;
}
function CheckConnectOptions(arg1, arg2, arg3) {
    let options = (typeof arg1 === 'object' ? arg1 : typeof arg2 === 'object' ? arg2 : typeof arg3 === 'object' ? arg3 : {});
    if (Number(arg1) >= 0) {
        options.port = Number(arg1);
        options.host = typeof arg2 === 'string' ? arg2 : undefined;
    }
    else if (typeof arg1 === 'string') {
        const parts = arg1.split(':');
        if ((parts.length === 2) && (Number(parts[1]) >= 0)) {
            options.port = Number(parts[1]);
            options.host = parts[0];
        }
        else {
            options.path = CleanPipeName(arg1);
        }
    }
    else if (typeof arg1 === 'object') {
        if (options.path) {
            options.path = CleanPipeName(arg1.path);
        }
    }
    if (options.timeoutDelay == null) {
        options.timeoutDelay = exports.IPC_BUS_TIMEOUT;
    }
    return options;
}
exports.CheckConnectOptions = CheckConnectOptions;
function JSON_stringify_array(data, maxLen, output) {
    output += '[';
    for (let i = 0, l = data.length; i < l; ++i) {
        if (output.length >= maxLen) {
            output += '\'__cut__\'';
            break;
        }
        output += JSON_stringify(data[i], maxLen - output.length);
        output += ',';
    }
    output += ']';
    return output;
}
function JSON_stringify_object(data, maxLen, output) {
    output += '{';
    if (data) {
        const keys = Object.keys(data);
        for (let i = 0, l = keys.length; i < l; ++i) {
            if (output.length >= maxLen) {
                output += '\'__cut__\'';
                break;
            }
            const key = keys[i];
            output += key + ': ';
            if (output.length >= maxLen) {
                output += '\'__cut__\'';
                break;
            }
            output += JSON_stringify(data[key], maxLen - output.length);
            output += ',';
        }
    }
    else {
        output += 'null';
    }
    output += '}';
    return output;
}
function JSON_stringify(data, maxLen) {
    let output = '';
    switch (typeof data) {
        case 'object':
            if (Buffer.isBuffer(data)) {
                output = data.toString('utf8', 0, maxLen);
            }
            else if (Array.isArray(data)) {
                output = JSON_stringify_array(data, maxLen, output);
            }
            else if (data instanceof Date) {
                output = data.toISOString();
            }
            else {
                output = JSON_stringify_object(data, maxLen, output);
            }
            break;
        case 'string':
            output = data.substr(0, maxLen);
            break;
        case 'number':
            output = data.toString();
            break;
        case 'boolean':
            output = data ? 'true' : 'false';
            break;
        case 'undefined':
            break;
    }
    return output;
}
exports.JSON_stringify = JSON_stringify;
class Logger {
    static info(msg) {
        console.log(msg);
    }
    static warn(msg) {
        console.warn(msg);
    }
    static error(msg) {
        console.error(msg);
    }
}
exports.Logger = Logger;
Logger.enable = false;
Logger.service = false;
;
function ContainsWildCards(str) {
    return str.charAt(str.length - 1) === '*';
}
exports.ContainsWildCards = ContainsWildCards;
function WildCardsToRegex(str) {
    return new RegExp(preg_quote(str).replace(/\\\*/g, '.*').replace(/\\\?/g, '.'), 'g');
}
exports.WildCardsToRegex = WildCardsToRegex;
function preg_quote(str) {
    return str.replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\-]', 'g'), '\\$&');
}
class ChannelConnectionMap extends events_1.EventEmitter {
    constructor(name, emitter) {
        super();
        this._name = name;
        this._emitter = emitter;
        this._channelsMap = new Map();
        this._requestChannels = new Map();
    }
    _info(str) {
        Logger.enable && Logger.info(`[${this._name}] ${str}`);
    }
    _warn(str) {
        Logger.enable && Logger.warn(`[${this._name}] ${str}`);
    }
    setRequestChannel(channel, conn) {
        this._requestChannels.set(channel, conn);
    }
    getRequestChannel(channel) {
        return this._requestChannels.get(channel);
    }
    deleteRequestChannel(channel) {
        return this._requestChannels.delete(channel);
    }
    hasChannel(channel) {
        return this._channelsMap.has(channel);
    }
    getChannels() {
        return Object.keys(this._channelsMap);
    }
    clear() {
        this._channelsMap.clear();
        this._requestChannels.clear();
    }
    addRef(channel, conn, peerId) {
        let channelAdded = false;
        Logger.enable && this._info(`AddRef: '${channel}', peerId = ${peerId}`);
        let connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            channelAdded = true;
            connsMap = new Map();
            this._channelsMap.set(channel, connsMap);
        }
        let connData = connsMap.get(conn);
        if (connData == null) {
            connData = new ConnectionData(conn, peerId);
            connsMap.set(conn, connData);
        }
        else {
            connData.addPeerId(peerId);
        }
        Logger.enable && this._info(`AddRef: '${channel}', count = ${connData.peerIds.size}`);
        if (channelAdded) {
            this._emitter && this.emit('channel-added', channel);
        }
        return connsMap.size;
    }
    _releaseConnData(channel, conn, connsMap, peerId, all) {
        let channelRemoved = false;
        const connData = connsMap.get(conn);
        if (connData == null) {
            Logger.enable && this._warn(`Release '${channel}': conn is unknown`);
            return 0;
        }
        else {
            if (peerId == null) {
                connData.clearPeerIds();
            }
            else {
                if (all) {
                    if (connData.removePeerId(peerId) === false) {
                        Logger.enable && this._warn(`Release '${channel}': peerId #${peerId} is unknown`);
                    }
                }
                else {
                    connData.releasePeerId(peerId);
                }
            }
            if (connData.peerIds.size === 0) {
                connsMap.delete(conn);
                if (connsMap.size === 0) {
                    channelRemoved = true;
                    this._channelsMap.delete(channel);
                }
            }
            Logger.enable && this._info(`Release '${channel}': count = ${connData.peerIds.size}`);
            if (channelRemoved) {
                this._emitter && this.emit('channel-removed', channel);
            }
            return connsMap.size;
        }
    }
    _release(channel, conn, peerId, all) {
        Logger.enable && this._info(`Release '${channel}' (${all}): peerId = ${peerId}`);
        const connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            Logger.enable && this._warn(`Release '${channel}': '${channel}' is unknown`);
            return 0;
        }
        else {
            return this._releaseConnData(channel, conn, connsMap, peerId, all);
        }
    }
    release(channel, conn, peerId) {
        return this._release(channel, conn, peerId, false);
    }
    releaseAll(channel, conn, peerId) {
        return this._release(channel, conn, peerId, true);
    }
    releasePeerId(conn, peerId) {
        Logger.enable && this._info(`releasePeerId: peerId = ${peerId}`);
        this._channelsMap.forEach((connsMap, channel) => {
            this._releaseConnData(channel, conn, connsMap, peerId, true);
        });
    }
    releaseConnection(conn) {
        Logger.enable && this._info(`ReleaseConn: conn = ${conn}`);
        this._requestChannels.forEach((connCurrent, channel) => {
            if (connCurrent === conn) {
                this._requestChannels.delete(channel);
            }
        });
        this._channelsMap.forEach((connsMap, channel) => {
            this._releaseConnData(channel, conn, connsMap, null, false);
        });
    }
    forEachChannel(channel, callback) {
        Logger.enable && this._info(`forEachChannel '${channel}'`);
        const connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            Logger.enable && this._warn(`forEachChannel: Unknown channel '${channel}' !`);
        }
        else {
            connsMap.forEach((connData, conn) => {
                Logger.enable && this._info(`forEachChannel '${channel}' - ${JSON.stringify(Array.from(connData.peerIds.keys()))} (${connData.peerIds.size})`);
                callback(connData, channel);
            });
        }
    }
    forEach(callback) {
        Logger.enable && this._info('forEach');
        this._channelsMap.forEach((connsMap, channel) => {
            connsMap.forEach((connData, conn) => {
                Logger.enable && this._info(`forEach '${channel}' - ${JSON.stringify(Array.from(connData.peerIds.keys()))} (${connData.peerIds.size})`);
                callback(connData, channel);
            });
        });
    }
    on(event, listener) {
        return super.addListener(event, listener);
    }
    off(event, listener) {
        return super.removeListener(event, listener);
    }
}
exports.ChannelConnectionMap = ChannelConnectionMap;
class ConnectionData {
    constructor(conn, peerId) {
        this.peerIds = new Map();
        this.conn = conn;
        const peerIdRefCount = { peerId, refCount: 1 };
        this.peerIds.set(peerId, peerIdRefCount);
    }
    addPeerId(peerId) {
        let peerIdRefCount = this.peerIds.get(peerId);
        if (peerIdRefCount == null) {
            peerIdRefCount = { peerId, refCount: 1 };
            this.peerIds.set(peerId, peerIdRefCount);
        }
        else {
            ++peerIdRefCount.refCount;
        }
        return peerIdRefCount.refCount;
    }
    clearPeerIds() {
        this.peerIds.clear();
    }
    removePeerId(peerId) {
        return this.peerIds.delete(peerId);
    }
    releasePeerId(peerId) {
        const peerIdRefCount = this.peerIds.get(peerId);
        if (peerIdRefCount == null) {
            return null;
        }
        else {
            if (--peerIdRefCount.refCount <= 0) {
                this.peerIds.delete(peerId);
            }
        }
        return peerIdRefCount.refCount;
    }
}
exports.ConnectionData = ConnectionData;
(function (ConnectionData_1) {
    ;
})(ConnectionData = exports.ConnectionData || (exports.ConnectionData = {}));
;

}).call(this,{"isBuffer":require("../../node_modules/is-buffer/index.js")},require('_process'))
},{"../../node_modules/is-buffer/index.js":27,"_process":37,"events":25}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IpcBusService_1 = require("./IpcBusService");
const IpcBusServiceImpl_1 = require("./IpcBusServiceImpl");
const IpcBusServiceProxyImpl_1 = require("./IpcBusServiceProxyImpl");
exports.CreateIpcBusService = (client, serviceName, serviceImpl, options) => {
    return new IpcBusServiceImpl_1.IpcBusServiceImpl(client, serviceName, serviceImpl);
};
IpcBusService_1.IpcBusService.Create = exports.CreateIpcBusService;
exports.CreateIpcBusServiceProxy = (client, serviceName, options) => {
    return new IpcBusServiceProxyImpl_1.IpcBusServiceProxyImpl(client, serviceName, options);
};
IpcBusService_1.IpcBusServiceProxy.Create = exports.CreateIpcBusServiceProxy;

},{"./IpcBusService":13,"./IpcBusServiceImpl":14,"./IpcBusServiceProxyImpl":15}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPCBUS_SERVICE_EVENT_START = 'service-event-start';
exports.IPCBUS_SERVICE_EVENT_STOP = 'service-event-stop';
var IpcBusService;
(function (IpcBusService) {
})(IpcBusService = exports.IpcBusService || (exports.IpcBusService = {}));
var IpcBusServiceProxy;
(function (IpcBusServiceProxy) {
})(IpcBusServiceProxy = exports.IpcBusServiceProxy || (exports.IpcBusServiceProxy = {}));

},{}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const Service = require("./IpcBusService");
const ServiceUtils = require("./IpcBusServiceUtils");
const IpcBusUtils = require("../IpcBusUtils");
function hasMethod(obj, name) {
    if (name === 'constructor') {
        return null;
    }
    if (name[0] === '_') {
        return null;
    }
    const desc = Object.getOwnPropertyDescriptor(obj, name);
    if (!!desc && (typeof desc.value === 'function')) {
        return desc;
    }
    return null;
}
function getInstanceMethodNames(obj) {
    const methodNames = new Map();
    Object.getOwnPropertyNames(obj)
        .forEach(name => {
        const desc = hasMethod(obj, name);
        if (desc) {
            methodNames.set(name, desc);
        }
    });
    let proto = Object.getPrototypeOf(obj);
    while (proto) {
        if (proto === events_1.EventEmitter.prototype) {
            for (let prop of Object.keys(events_1.EventEmitter.prototype)) {
                if (prop[0] !== '_') {
                    methodNames.delete(prop);
                }
            }
            methodNames.delete('off');
            break;
        }
        else if (proto === Object.prototype) {
            break;
        }
        Object.getOwnPropertyNames(proto)
            .forEach(name => {
            const desc = hasMethod(proto, name);
            if (desc) {
                methodNames.set(name, desc);
            }
        });
        proto = Object.getPrototypeOf(proto);
    }
    return methodNames;
}
class IpcBusServiceImpl {
    constructor(_ipcBusClient, _serviceName, _exposedInstance, options) {
        this._ipcBusClient = _ipcBusClient;
        this._serviceName = _serviceName;
        this._exposedInstance = _exposedInstance;
        this._prevImplEmit = null;
        this._callHandlers = new Map();
        this._onCallReceived = this._onCallReceived.bind(this);
        this.registerCallHandler(ServiceUtils.IPCBUS_SERVICE_CALL_GETSTATUS, () => {
            return this._getServiceStatus();
        });
        if (this._exposedInstance) {
            const methodNames = getInstanceMethodNames(this._exposedInstance);
            methodNames.forEach((methodDesc, methodName) => {
                this.registerCallHandler(methodName, methodDesc.value);
            });
        }
        else {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' does NOT have an implementation`);
        }
    }
    _getServiceStatus() {
        const serviceStatus = {
            started: true,
            callHandlers: this._getCallHandlerNames(),
            supportEventEmitter: (this._prevImplEmit != null)
        };
        return serviceStatus;
    }
    start() {
        if (this._exposedInstance && this._exposedInstance['emit']) {
            this._prevImplEmit = this._exposedInstance['emit'];
            this._exposedInstance['emit'] = (eventName, ...args) => {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is emitting event '${eventName}'`);
                this.sendEvent(ServiceUtils.IPCBUS_SERVICE_WRAPPER_EVENT, eventName, args);
                this._prevImplEmit.call(this._exposedInstance, eventName, ...args);
            };
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' will send events emitted by its implementation`);
        }
        this._ipcBusClient.addListener(ServiceUtils.getServiceCallChannel(this._serviceName), this._onCallReceived);
        this.sendEvent(Service.IPCBUS_SERVICE_EVENT_START, this._getServiceStatus());
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is STARTED`);
    }
    stop() {
        if (this._exposedInstance && this._prevImplEmit) {
            this._exposedInstance['emit'] = this._prevImplEmit;
            this._prevImplEmit = null;
        }
        this.sendEvent(Service.IPCBUS_SERVICE_EVENT_STOP, {});
        this._ipcBusClient.removeListener(ServiceUtils.getServiceCallChannel(this._serviceName), this._onCallReceived);
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is STOPPED`);
    }
    registerCallHandler(name, handler) {
        this._callHandlers.set(name, handler);
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' registered call handler '${name}'`);
    }
    unregisterCallHandler(name) {
        this._callHandlers.delete(name);
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' unregistered call handler '${name}'`);
    }
    sendEvent(name, ...args) {
        const eventMsg = { eventName: name, args: args };
        this._ipcBusClient.send(ServiceUtils.getServiceEventChannel(this._serviceName), eventMsg);
    }
    _onCallReceived(event, call) {
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is calling implementation's '${call.handlerName}'`);
        const callHandler = this._callHandlers.get(call.handlerName);
        try {
            if (!callHandler) {
                throw `Function unknown !`;
            }
            else {
                const result = callHandler.apply(this._exposedInstance, call.args);
                if (event.request) {
                    if (result && result['then']) {
                        result.then(event.request.resolve, event.request.reject);
                    }
                    else {
                        event.request.resolve(result);
                    }
                }
            }
        }
        catch (e) {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' encountered an exception while processing call to '${call.handlerName}' : ${e}`);
            if (event.request) {
                event.request.reject(e);
            }
        }
    }
    _getCallHandlerNames() {
        const callHandlerNames = Array.from(this._callHandlers.keys()).filter((name) => name[0] !== '_');
        return callHandlerNames;
    }
}
exports.IpcBusServiceImpl = IpcBusServiceImpl;

},{"../IpcBusUtils":11,"./IpcBusService":13,"./IpcBusServiceUtils":16,"events":25}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const Service = require("./IpcBusService");
const ServiceUtils = require("./IpcBusServiceUtils");
const IpcBusUtils = require("../IpcBusUtils");
class Deferred {
    constructor(executor, immediat = true) {
        this.id = ++Deferred._globalCounter;
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
            if (immediat) {
                if (executor) {
                    executor(resolve, reject);
                }
            }
            else {
                this._executor = executor;
            }
        });
    }
    execute() {
        if (this._executor) {
            this._executor(this.resolve, this.reject);
        }
    }
    then(...args) {
        return this.promise.then(...args);
    }
    catch(...args) {
        return this.promise.catch(...args);
    }
}
Deferred._globalCounter = 0;
class CallWrapperEventEmitter extends events_1.EventEmitter {
}
class IpcBusServiceProxyImpl extends events_1.EventEmitter {
    constructor(ipcBusClient, serviceName, options) {
        super();
        super.setMaxListeners(0);
        this._ipcBusClient = ipcBusClient;
        this._serviceName = serviceName;
        options = options || {};
        options.timeoutDelay = options.timeoutDelay || IpcBusUtils.IPC_BUS_TIMEOUT;
        this._options = options;
        this._pendingCalls = new Map();
        this._wrapper = new CallWrapperEventEmitter();
        this._isStarted = false;
        this.getStatus()
            .then((serviceStatus) => {
            this._onServiceStart(serviceStatus);
        })
            .catch((err) => {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] first status to '${this._serviceName}' - err: ${err}`);
        });
        this._onServiceReceived = this._onServiceReceived.bind(this);
        this._ipcBusClient.addListener(ServiceUtils.getServiceEventChannel(this._serviceName), this._onServiceReceived);
    }
    connect(options) {
        options = options || {};
        if (options.timeoutDelay == null) {
            options.timeoutDelay = this._options.timeoutDelay;
        }
        return new Promise((resolve, reject) => {
            if (this._isStarted) {
                return resolve(this.getWrapper());
            }
            let timer;
            const serviceStart = () => {
                clearTimeout(timer);
                this.removeListener(Service.IPCBUS_SERVICE_EVENT_START, serviceStart);
                resolve(this.getWrapper());
            };
            if (options.timeoutDelay >= 0) {
                timer = setTimeout(() => {
                    this.removeListener(Service.IPCBUS_SERVICE_EVENT_START, serviceStart);
                    reject('timeout');
                }, options.timeoutDelay);
            }
            this.addListener(Service.IPCBUS_SERVICE_EVENT_START, serviceStart);
        });
    }
    get isStarted() {
        return this._isStarted;
    }
    getWrapper() {
        const typed_wrapper = this._wrapper;
        return typed_wrapper;
    }
    get wrapper() {
        return this._wrapper;
    }
    getStatus() {
        return this._call(ServiceUtils.IPCBUS_SERVICE_CALL_GETSTATUS);
    }
    _requestApply(name, args) {
        const deferred = new Deferred((resolve, reject) => {
            const callMsg = { handlerName: name, args: args };
            this._ipcBusClient.request(ServiceUtils.getServiceCallChannel(this._serviceName), -1, callMsg)
                .then((res) => {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] resolve call to '${name}' from service '${this._serviceName}' - res: ${JSON.stringify(res)}`);
                this._pendingCalls.delete(deferred.id);
                resolve(res.payload);
            })
                .catch((res) => {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] reject call to '${name}' from service '${this._serviceName}' - res: ${JSON.stringify(res)}`);
                this._pendingCalls.delete(deferred.id);
                reject(res.err);
            });
        }, false);
        this._pendingCalls.set(deferred.id, deferred);
        return deferred;
    }
    _call(name, ...args) {
        const deferred = this._requestApply(name, args);
        deferred.execute();
        return deferred.promise;
    }
    requestApply(name, args) {
        const deferred = this._requestApply(name, args);
        if (this._isStarted) {
            deferred.execute();
        }
        else {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] call delayed '${name}' from service '${this._serviceName}'`);
        }
        return deferred.promise;
    }
    requestCall(name, ...args) {
        return this.requestApply(name, args);
    }
    apply(name, args) {
        return this.requestApply(name, args);
    }
    call(name, ...args) {
        return this.requestApply(name, args);
    }
    _sendApply(name, args) {
        const deferred = new Deferred((resolve, reject) => {
            const callMsg = { handlerName: name, args: args };
            this._ipcBusClient.send(ServiceUtils.getServiceCallChannel(this._serviceName), -1, callMsg);
            this._pendingCalls.delete(deferred.id);
        }, false);
        this._pendingCalls.set(deferred.id, deferred);
        return deferred;
    }
    sendApply(name, args) {
        if (this._isStarted) {
            const callMsg = { handlerName: name, args: args };
            this._ipcBusClient.send(ServiceUtils.getServiceCallChannel(this._serviceName), -1, callMsg);
        }
        else {
            this._sendApply(name, args);
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] call delayed '${name}' from service '${this._serviceName}'`);
        }
    }
    sendCall(name, ...args) {
        return this.sendApply(name, args);
    }
    _updateWrapper(serviceStatus) {
        for (let i = 0, l = serviceStatus.callHandlers.length; i < l; ++i) {
            const handlerName = serviceStatus.callHandlers[i];
            const requestProc = (...args) => {
                return this.requestApply(handlerName, args);
            };
            const sendProc = (...args) => {
                return this.sendApply(handlerName, args);
            };
            this._wrapper[handlerName] = requestProc;
            this._wrapper[`request_${handlerName}`] = requestProc;
            this._wrapper[`send_${handlerName}`] = sendProc;
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' added '${handlerName}' to its wrapper`);
        }
    }
    _onServiceReceived(event, msg) {
        if (msg.eventName === ServiceUtils.IPCBUS_SERVICE_WRAPPER_EVENT) {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Wrapper '${this._serviceName}' receive event '${msg.args[0]}'`);
            this._wrapper.emit(msg.args[0], ...msg.args[1]);
            this.emit(msg.args[0], ...msg.args[1]);
        }
        else {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' receive event '${msg.eventName}'`);
            switch (msg.eventName) {
                case Service.IPCBUS_SERVICE_EVENT_START:
                    this._onServiceStart(msg.args[0]);
                    break;
                case Service.IPCBUS_SERVICE_EVENT_STOP:
                    this._onServiceStop();
                    break;
                default:
                    this.emit(msg.eventName, ...msg.args);
                    break;
            }
        }
    }
    _onServiceStart(serviceStatus) {
        if (!this._isStarted && serviceStatus.started) {
            this._isStarted = true;
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is STARTED`);
            this._updateWrapper(serviceStatus);
            this.emit(Service.IPCBUS_SERVICE_EVENT_START, serviceStatus);
            this._pendingCalls.forEach((deferred) => {
                deferred.execute();
            });
        }
    }
    _onServiceStop() {
        if (this._isStarted) {
            this._isStarted = false;
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is STOPPED`);
            this.emit(Service.IPCBUS_SERVICE_EVENT_STOP);
            this._pendingCalls.forEach((deferred) => {
                deferred.reject(`Service '${this._serviceName}' stopped`);
            });
        }
    }
}
exports.IpcBusServiceProxyImpl = IpcBusServiceProxyImpl;

},{"../IpcBusUtils":11,"./IpcBusService":13,"./IpcBusServiceUtils":16,"events":25}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Client = require("../IpcBusClient");
exports.IPCBUS_SERVICE_WRAPPER_EVENT = 'service-wrapper-event';
exports.IPCBUS_SERVICE_CALL_GETSTATUS = '__getServiceStatus';
exports.IPCBUS_SERVICE_ADD_LISTENER = '_addListener';
exports.IPCBUS_SERVICE_REMOVE_LISTENER = '_removeListener';
function getServiceNamespace(serviceName) {
    return `${Client.IPCBUS_CHANNEL}/ipc-service/${serviceName}`;
}
exports.getServiceNamespace = getServiceNamespace;
function getServiceCallChannel(serviceName) {
    return getServiceNamespace(serviceName) + '/call';
}
exports.getServiceCallChannel = getServiceCallChannel;
function getServiceEventChannel(serviceName) {
    return getServiceNamespace(serviceName) + '/event';
}
exports.getServiceEventChannel = getServiceEventChannel;

},{"../IpcBusClient":4}],17:[function(require,module,exports){
"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
__export(require("./electron-common-ipc-common"));
__export(require("./IpcBus/IpcBusClient-factory-browser"));
const IpcBusRendererPreload_1 = require("./IpcBus/IpcBusRendererPreload");
IpcBusRendererPreload_1.PreloadElectronCommonIpcAutomatic();

},{"./IpcBus/IpcBusClient-factory-browser":3,"./IpcBus/IpcBusRendererPreload":8,"./electron-common-ipc-common":18}],18:[function(require,module,exports){
"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
__export(require("./IpcBus/IpcBusClient"));
__export(require("./IpcBus/service/IpcBusService"));
__export(require("./IpcBus/service/IpcBusService-factory"));
__export(require("./IpcBus/IpcBusRendererPreload"));
const IpcBusUtils = require("./IpcBus/IpcBusUtils");
function ActivateIpcBusTrace(enable) {
    IpcBusUtils.Logger.enable = enable;
}
exports.ActivateIpcBusTrace = ActivateIpcBusTrace;
function ActivateServiceTrace(enable) {
    IpcBusUtils.Logger.service = enable;
}
exports.ActivateServiceTrace = ActivateServiceTrace;

},{"./IpcBus/IpcBusClient":4,"./IpcBus/IpcBusRendererPreload":8,"./IpcBus/IpcBusUtils":11,"./IpcBus/service/IpcBusService":13,"./IpcBus/service/IpcBusService-factory":12}],19:[function(require,module,exports){
(function (global){
'use strict';

var objectAssign = require('object-assign');

// compare and isBuffer taken from https://github.com/feross/buffer/blob/680e9e5e488f22aac27599a57dc844a6315928dd/index.js
// original notice:

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
function compare(a, b) {
  if (a === b) {
    return 0;
  }

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }

  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
}
function isBuffer(b) {
  if (global.Buffer && typeof global.Buffer.isBuffer === 'function') {
    return global.Buffer.isBuffer(b);
  }
  return !!(b != null && b._isBuffer);
}

// based on node assert, original notice:
// NB: The URL to the CommonJS spec is kept just for tradition.
//     node-assert has evolved a lot since then, both in API and behavior.

// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = require('util/');
var hasOwn = Object.prototype.hasOwnProperty;
var pSlice = Array.prototype.slice;
var functionsHaveNames = (function () {
  return function foo() {}.name === 'foo';
}());
function pToString (obj) {
  return Object.prototype.toString.call(obj);
}
function isView(arrbuf) {
  if (isBuffer(arrbuf)) {
    return false;
  }
  if (typeof global.ArrayBuffer !== 'function') {
    return false;
  }
  if (typeof ArrayBuffer.isView === 'function') {
    return ArrayBuffer.isView(arrbuf);
  }
  if (!arrbuf) {
    return false;
  }
  if (arrbuf instanceof DataView) {
    return true;
  }
  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
    return true;
  }
  return false;
}
// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

var regex = /\s*function\s+([^\(\s]*)\s*/;
// based on https://github.com/ljharb/function.prototype.name/blob/adeeeec8bfcc6068b187d7d9fb3d5bb1d3a30899/implementation.js
function getName(func) {
  if (!util.isFunction(func)) {
    return;
  }
  if (functionsHaveNames) {
    return func.name;
  }
  var str = func.toString();
  var match = str.match(regex);
  return match && match[1];
}
assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = getName(stackStartFunction);
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function truncate(s, n) {
  if (typeof s === 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}
function inspect(something) {
  if (functionsHaveNames || !util.isFunction(something)) {
    return util.inspect(something);
  }
  var rawname = getName(something);
  var name = rawname ? ': ' + rawname : '';
  return '[Function' +  name + ']';
}
function getMessage(self) {
  return truncate(inspect(self.actual), 128) + ' ' +
         self.operator + ' ' +
         truncate(inspect(self.expected), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'deepStrictEqual', assert.deepStrictEqual);
  }
};

function _deepEqual(actual, expected, strict, memos) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  } else if (isBuffer(actual) && isBuffer(expected)) {
    return compare(actual, expected) === 0;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if ((actual === null || typeof actual !== 'object') &&
             (expected === null || typeof expected !== 'object')) {
    return strict ? actual === expected : actual == expected;

  // If both values are instances of typed arrays, wrap their underlying
  // ArrayBuffers in a Buffer each to increase performance
  // This optimization requires the arrays to have the same type as checked by
  // Object.prototype.toString (aka pToString). Never perform binary
  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
  // bit patterns are not identical.
  } else if (isView(actual) && isView(expected) &&
             pToString(actual) === pToString(expected) &&
             !(actual instanceof Float32Array ||
               actual instanceof Float64Array)) {
    return compare(new Uint8Array(actual.buffer),
                   new Uint8Array(expected.buffer)) === 0;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else if (isBuffer(actual) !== isBuffer(expected)) {
    return false;
  } else {
    memos = memos || {actual: [], expected: []};

    var actualIndex = memos.actual.indexOf(actual);
    if (actualIndex !== -1) {
      if (actualIndex === memos.expected.indexOf(expected)) {
        return true;
      }
    }

    memos.actual.push(actual);
    memos.expected.push(expected);

    return objEquiv(actual, expected, strict, memos);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b, strict, actualVisitedObjects) {
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b))
    return a === b;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
    return false;
  var aIsArgs = isArguments(a);
  var bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b, strict);
  }
  var ka = objectKeys(a);
  var kb = objectKeys(b);
  var key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length !== kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects))
      return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

assert.notDeepStrictEqual = notDeepStrictEqual;
function notDeepStrictEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
  }
}


// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  }

  try {
    if (actual instanceof expected) {
      return true;
    }
  } catch (e) {
    // Ignore.  The instanceof check doesn't work for arrow functions.
  }

  if (Error.isPrototypeOf(expected)) {
    return false;
  }

  return expected.call({}, actual) === true;
}

function _tryBlock(block) {
  var error;
  try {
    block();
  } catch (e) {
    error = e;
  }
  return error;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof block !== 'function') {
    throw new TypeError('"block" argument must be a function');
  }

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  actual = _tryBlock(block);

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  var userProvidedMessage = typeof message === 'string';
  var isUnwantedException = !shouldThrow && util.isError(actual);
  var isUnexpectedException = !shouldThrow && actual && !expected;

  if ((isUnwantedException &&
      userProvidedMessage &&
      expectedException(actual, expected)) ||
      isUnexpectedException) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws(true, block, error, message);
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws(false, block, error, message);
};

assert.ifError = function(err) { if (err) throw err; };

// Expose a strict only variant of assert
function strict(value, message) {
  if (!value) fail(value, true, message, '==', strict);
}
assert.strict = objectAssign(strict, assert, {
  equal: assert.strictEqual,
  deepEqual: assert.deepStrictEqual,
  notEqual: assert.notStrictEqual,
  notDeepEqual: assert.notDeepStrictEqual
});
assert.strict.strict = assert.strict;

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"object-assign":36,"util/":22}],20:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],21:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],22:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":21,"_process":37,"inherits":20}],23:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],24:[function(require,module,exports){
(function (Buffer){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var customInspectSymbol =
  (typeof Symbol === 'function' && typeof Symbol.for === 'function')
    ? Symbol.for('nodejs.util.inspect.custom')
    : null

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    var proto = { foo: function () { return 42 } }
    Object.setPrototypeOf(proto, Uint8Array.prototype)
    Object.setPrototypeOf(arr, proto)
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  Object.setPrototypeOf(buf, Buffer.prototype)
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw new TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype)
Object.setPrototypeOf(Buffer, Uint8Array)

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(buf, Buffer.prototype)

  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}
if (customInspectSymbol) {
  Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += hexSliceLookupTable[buf[i]]
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(newBuf, Buffer.prototype)

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  } else if (typeof val === 'boolean') {
    val = Number(val)
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

// Create lookup table for `toString('hex')`
// See: https://github.com/feross/buffer/issues/219
var hexSliceLookupTable = (function () {
  var alphabet = '0123456789abcdef'
  var table = new Array(256)
  for (var i = 0; i < 16; ++i) {
    var i16 = i * 16
    for (var j = 0; j < 16; ++j) {
      table[i16 + j] = alphabet[i] + alphabet[j]
    }
  }
  return table
})()

}).call(this,require("buffer").Buffer)
},{"base64-js":23,"buffer":24,"ieee754":26}],25:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],26:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],27:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],28:[function(require,module,exports){
(function (Buffer){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const json_formatter_1 = require("./json-formatter");
exports.dateJSONSupport = new json_formatter_1.JSONFormatter('Date', Date, (t) => t.valueOf(), (data) => new Date(data));
exports.errorJSONSupport = new json_formatter_1.JSONFormatter('Error', Error, (t) => t.message, (data) => new Error(data));
exports.typeErrorJSONSupport = new json_formatter_1.JSONFormatter('TypeError', TypeError, (t) => t.message, (data) => new TypeError(data));
exports.bufferJSONSupport = new json_formatter_1.JSONFormatter('Buffer', Buffer, null, (data) => Buffer.from(data));
exports.bufferJSONSupportBinary = new json_formatter_1.JSONFormatter('Buffer', Buffer, (t) => t.toString('binary'), (data) => Buffer.from(data, 'binary'));

}).call(this,require("buffer").Buffer)
},{"./json-formatter":29,"buffer":24}],29:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class JSONFormatter {
    constructor(objectName, objectConstructor, serialize, unserialize) {
        this.objectName = objectName;
        this.objectConstructor = objectConstructor;
        this.previousToJSON = Object.getOwnPropertyDescriptor(objectConstructor.prototype, 'toJSON');
        this.unserialize = unserialize;
        this.serialize = serialize;
    }
    create(data) {
        return this.unserialize(data);
    }
    install() {
        if (this.serialize) {
            const self = this;
            try {
                Object.defineProperty(this.objectConstructor.prototype, 'toJSON', {
                    value: function () {
                        return { type: self.objectName, data: self.serialize(this) };
                    },
                    configurable: true
                });
            }
            catch (err) {
            }
        }
    }
    uninstall() {
        if (this.serialize) {
            try {
                if (this.previousToJSON) {
                    const self = this;
                    Object.defineProperty(this.objectConstructor.prototype, 'toJSON', self.previousToJSON);
                }
                else {
                    Object.defineProperty(this.objectConstructor.prototype, 'toJSON', {
                        value: function () {
                            return this.toString();
                        },
                        configurable: true,
                        enumerable: false
                    });
                }
            }
            catch (err) {
            }
        }
    }
}
exports.JSONFormatter = JSONFormatter;

},{}],30:[function(require,module,exports){
"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
__export(require("./json-parser"));
const v1 = require("./tojson-v1");
v1;
const v2 = require("./tojson-v2");
v2;

},{"./json-parser":31,"./tojson-v1":33,"./tojson-v2":34}],31:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tojson_1 = require("./tojson");
var JSONParser;
(function (JSONParser) {
    function stringify(value, replacer, space) {
        const toJSONReplacer = tojson_1.ToJSONReplacer.Get();
        return toJSONReplacer.stringify(value, replacer, space);
    }
    JSONParser.stringify = stringify;
    function parse(text, reviver) {
        const toJSONReviver = tojson_1.ToJSONReviver.Get();
        return toJSONReviver.parse(text, reviver);
    }
    JSONParser.parse = parse;
})(JSONParser = exports.JSONParser || (exports.JSONParser = {}));
var JSONParserV2;
(function (JSONParserV2) {
    function stringify(value, replacer, space) {
        const toJSONReplacer = tojson_1.ToJSONReplacer.GetV2();
        return toJSONReplacer.stringify(value, replacer, space);
    }
    JSONParserV2.stringify = stringify;
    function parse(text, reviver) {
        const toJSONReviver = tojson_1.ToJSONReviver.GetV2();
        return toJSONReviver.parse(text, reviver);
    }
    JSONParserV2.parse = parse;
})(JSONParserV2 = exports.JSONParserV2 || (exports.JSONParserV2 = {}));

},{"./tojson":35}],32:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tojson_1 = require("./tojson");
class ToJSONReplacerImpl {
    constructor(jsonFormattersMap) {
        this._jsonFormattersMap = jsonFormattersMap;
    }
    install() {
        this._jsonFormattersMap.forEach(item => {
            item.install();
        });
    }
    uninstall() {
        this._jsonFormattersMap.forEach(item => {
            item.uninstall();
        });
    }
    replacer(key, value) {
        if (typeof key === 'undefined') {
            return tojson_1.ToJSONConstants.JSON_TOKEN_UNDEFINED;
        }
        return value;
    }
    replacerChain(replacer, key, value) {
        if (typeof key === 'undefined') {
            return tojson_1.ToJSONConstants.JSON_TOKEN_UNDEFINED;
        }
        return replacer(key, value);
    }
    stringify(value, replacer, space) {
        this.install();
        try {
            const replacerCb = replacer ? this.replacerChain.bind(this, replacer) : this.replacer.bind(this);
            const result = JSON.stringify(value, replacerCb, space);
            this.uninstall();
            return result;
        }
        catch (err) {
            this.uninstall();
            throw err;
        }
    }
}
exports.ToJSONReplacerImpl = ToJSONReplacerImpl;
class ToJSONReviverImpl {
    constructor(jsonFormattersMap) {
        this._jsonFormattersMap = jsonFormattersMap;
    }
    reviver(key, value) {
        if (value) {
            if (value === tojson_1.ToJSONConstants.JSON_TOKEN_UNDEFINED) {
                return undefined;
            }
            if ((typeof value.type === 'string') && value.hasOwnProperty('data')) {
                const format = this._jsonFormattersMap.get(value.type);
                if (format) {
                    return format.create(value.data);
                }
            }
        }
        return value;
    }
    reviverChain(reviver, key, value) {
        if (value) {
            if (value === tojson_1.ToJSONConstants.JSON_TOKEN_UNDEFINED) {
                return undefined;
            }
            if ((typeof value.type === 'string') && value.hasOwnProperty('data')) {
                const format = this._jsonFormattersMap.get(value.type);
                if (format) {
                    return format.create(value.data);
                }
            }
        }
        return reviver(key, value);
    }
    parse(text, reviver) {
        const reviverCb = reviver ? this.reviverChain.bind(this, reviver) : this.reviver.bind(this);
        return JSON.parse(text, reviverCb);
    }
}
exports.ToJSONReviverImpl = ToJSONReviverImpl;

},{"./tojson":35}],33:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tojson_1 = require("./tojson");
const tojson_impl_1 = require("./tojson-impl");
const json_formatter_default_1 = require("./json-formatter-default");
const jsonFormattersMap = new Map();
jsonFormattersMap.set(json_formatter_default_1.dateJSONSupport.objectName, json_formatter_default_1.dateJSONSupport);
jsonFormattersMap.set(json_formatter_default_1.errorJSONSupport.objectName, json_formatter_default_1.errorJSONSupport);
jsonFormattersMap.set(json_formatter_default_1.typeErrorJSONSupport.objectName, json_formatter_default_1.typeErrorJSONSupport);
jsonFormattersMap.set(json_formatter_default_1.bufferJSONSupport.objectName, json_formatter_default_1.bufferJSONSupport);
const jsonReplacer = new tojson_impl_1.ToJSONReplacerImpl(jsonFormattersMap);
tojson_1.ToJSONReplacer.Get = tojson_1.ToJSONReplacer.GetV1 = () => {
    return jsonReplacer;
};
const jsonReviver = new tojson_impl_1.ToJSONReviverImpl(jsonFormattersMap);
tojson_1.ToJSONReviver.Get = tojson_1.ToJSONReviver.GetV1 = () => {
    return jsonReviver;
};

},{"./json-formatter-default":28,"./tojson":35,"./tojson-impl":32}],34:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tojson_1 = require("./tojson");
const tojson_impl_1 = require("./tojson-impl");
const json_formatter_default_1 = require("./json-formatter-default");
const jsonFormattersMap = new Map();
jsonFormattersMap.set(json_formatter_default_1.dateJSONSupport.objectName, json_formatter_default_1.dateJSONSupport);
jsonFormattersMap.set(json_formatter_default_1.errorJSONSupport.objectName, json_formatter_default_1.errorJSONSupport);
jsonFormattersMap.set(json_formatter_default_1.typeErrorJSONSupport.objectName, json_formatter_default_1.typeErrorJSONSupport);
jsonFormattersMap.set(json_formatter_default_1.bufferJSONSupportBinary.objectName, json_formatter_default_1.bufferJSONSupportBinary);
const jsonReplacer = new tojson_impl_1.ToJSONReplacerImpl(jsonFormattersMap);
tojson_1.ToJSONReplacer.GetV2 = () => {
    return jsonReplacer;
};
const jsonReviver = new tojson_impl_1.ToJSONReviverImpl(jsonFormattersMap);
tojson_1.ToJSONReviver.GetV2 = () => {
    return jsonReviver;
};

},{"./json-formatter-default":28,"./tojson":35,"./tojson-impl":32}],35:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ToJSONConstants;
(function (ToJSONConstants) {
    ToJSONConstants.JSON_TOKEN_UNDEFINED = '_/undefined/_';
})(ToJSONConstants = exports.ToJSONConstants || (exports.ToJSONConstants = {}));
var ToJSONReplacer;
(function (ToJSONReplacer) {
})(ToJSONReplacer = exports.ToJSONReplacer || (exports.ToJSONReplacer = {}));
var ToJSONReviver;
(function (ToJSONReviver) {
})(ToJSONReviver = exports.ToJSONReviver || (exports.ToJSONReviver = {}));

},{}],36:[function(require,module,exports){
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

'use strict';
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],37:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],38:[function(require,module,exports){
var v1 = require('./v1');
var v4 = require('./v4');

var uuid = v4;
uuid.v1 = v1;
uuid.v4 = v4;

module.exports = uuid;

},{"./v1":41,"./v4":42}],39:[function(require,module,exports){
/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
var byteToHex = [];
for (var i = 0; i < 256; ++i) {
  byteToHex[i] = (i + 0x100).toString(16).substr(1);
}

function bytesToUuid(buf, offset) {
  var i = offset || 0;
  var bth = byteToHex;
  // join used to fix memory issue caused by concatenation: https://bugs.chromium.org/p/v8/issues/detail?id=3175#c4
  return ([bth[buf[i++]], bth[buf[i++]], 
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]],
	bth[buf[i++]], bth[buf[i++]],
	bth[buf[i++]], bth[buf[i++]]]).join('');
}

module.exports = bytesToUuid;

},{}],40:[function(require,module,exports){
// Unique ID creation requires a high quality random # generator.  In the
// browser this is a little complicated due to unknown quality of Math.random()
// and inconsistent support for the `crypto` API.  We do the best we can via
// feature-detection

// getRandomValues needs to be invoked in a context where "this" is a Crypto
// implementation. Also, find the complete implementation of crypto on IE11.
var getRandomValues = (typeof(crypto) != 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto)) ||
                      (typeof(msCrypto) != 'undefined' && typeof window.msCrypto.getRandomValues == 'function' && msCrypto.getRandomValues.bind(msCrypto));

if (getRandomValues) {
  // WHATWG crypto RNG - http://wiki.whatwg.org/wiki/Crypto
  var rnds8 = new Uint8Array(16); // eslint-disable-line no-undef

  module.exports = function whatwgRNG() {
    getRandomValues(rnds8);
    return rnds8;
  };
} else {
  // Math.random()-based (RNG)
  //
  // If all else fails, use Math.random().  It's fast, but is of unspecified
  // quality.
  var rnds = new Array(16);

  module.exports = function mathRNG() {
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return rnds;
  };
}

},{}],41:[function(require,module,exports){
var rng = require('./lib/rng');
var bytesToUuid = require('./lib/bytesToUuid');

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

var _nodeId;
var _clockseq;

// Previous uuid creation time
var _lastMSecs = 0;
var _lastNSecs = 0;

// See https://github.com/broofa/node-uuid for API details
function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || [];

  options = options || {};
  var node = options.node || _nodeId;
  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

  // node and clockseq need to be initialized to random values if they're not
  // specified.  We do this lazily to minimize issues related to insufficient
  // system entropy.  See #189
  if (node == null || clockseq == null) {
    var seedBytes = rng();
    if (node == null) {
      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
      node = _nodeId = [
        seedBytes[0] | 0x01,
        seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]
      ];
    }
    if (clockseq == null) {
      // Per 4.2.2, randomize (14 bit) clockseq
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
    }
  }

  // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
  var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

  // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock
  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

  // Time since last uuid creation (in msecs)
  var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

  // Per 4.2.1.2, Bump clockseq on clock regression
  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  }

  // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  }

  // Per 4.2.1.2 Throw error if too many uuids are requested
  if (nsecs >= 10000) {
    throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;

  // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
  msecs += 12219292800000;

  // `time_low`
  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff;

  // `time_mid`
  var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff;

  // `time_high_and_version`
  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
  b[i++] = tmh >>> 16 & 0xff;

  // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
  b[i++] = clockseq >>> 8 | 0x80;

  // `clock_seq_low`
  b[i++] = clockseq & 0xff;

  // `node`
  for (var n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf ? buf : bytesToUuid(b);
}

module.exports = v1;

},{"./lib/bytesToUuid":39,"./lib/rng":40}],42:[function(require,module,exports){
var rng = require('./lib/rng');
var bytesToUuid = require('./lib/bytesToUuid');

function v4(options, buf, offset) {
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options === 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ++ii) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || bytesToUuid(rnds);
}

module.exports = v4;

},{"./lib/bytesToUuid":39,"./lib/rng":40}],43:[function(require,module,exports){
const electronCommonIpcModule = require('../../lib/electron-common-ipc');
electronCommonIpcModule.PreloadElectronCommonIpc();

console.log(`IsElectronCommonIpcAvailable=${electronCommonIpcModule.IsElectronCommonIpcAvailable()}`);

const electron = require('electron');
window.ipcRenderer = electron.ipcRenderer;


},{"../../lib/electron-common-ipc":17,"electron":"electron"}]},{},[43]);
