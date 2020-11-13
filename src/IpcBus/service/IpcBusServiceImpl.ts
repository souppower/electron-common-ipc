import { EventEmitter } from 'events';

import * as Client from '../IpcBusClient';
import * as Service from './IpcBusService';
import * as ServiceUtils from './IpcBusServiceUtils';

import * as IpcBusUtils from '../IpcBusUtils';

function hasMethod(obj: any, name: string): PropertyDescriptor | null {
    if (name === 'constructor') {
        return null;
    }
    // Hide private methods, supposed to be pre-fixed by one or several underscores
    if (name[0] === '_') {
        return null;
    }
    const desc = Object.getOwnPropertyDescriptor(obj, name);
    if (!!desc && (typeof desc.value === 'function')) {
        return desc;
    }
    return null;
}

function getInstanceMethodNames(obj: any): Map<string, PropertyDescriptor> {
    const methodNames = new Map<string, PropertyDescriptor>();

    Object.getOwnPropertyNames(obj)
        .forEach(name => {
            const desc = hasMethod(obj, name);
            if (desc) {
                methodNames.set(name, desc);
            }
        });

    let proto = Object.getPrototypeOf(obj);
    while (proto) {
        if (proto === EventEmitter.prototype) {
            // Remove EventEmitter overriden methods
            for (let prop of Object.keys(EventEmitter.prototype)) {
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

// Implementation of IPC service
/** @internal */
export class IpcBusServiceImpl implements Service.IpcBusService {
    private _callHandlers: Map<string, Function>;
    // private _eventHandlers: Map<string, Set<string>>;
    private _prevImplEmit: Function = null;

    constructor(private _ipcBusClient: Client.IpcBusClient, private _serviceName: string, private _exposedInstance: any, options?: Service.IpcBusService.CreateOptions) {
        this._callHandlers = new Map<string, Function>();
        // this._eventHandlers = new Map<string, Set<string>>();

        // Callback
        this._onCallReceived = this._onCallReceived.bind(this);

        //  Register internal call handlers
        this.registerCallHandler(ServiceUtils.IPCBUS_SERVICE_CALL_GETSTATUS, () => {
            return this._getServiceStatus();
        });
        // this.registerCallHandler(ServiceUtils.IPCBUS_SERVICE_ADD_LISTENER, (event: string, replyChannel: string) => {
        //     return this._addListener(event, replyChannel);
        // });
        // this.registerCallHandler(ServiceUtils.IPCBUS_SERVICE_REMOVE_LISTENER, (event: string, replyChannel: string) => {
        //     return this._removeListener(event, replyChannel);
        // });
        //  Register call handlers for exposed instance's method
        if (this._exposedInstance) {
            const methodNames = getInstanceMethodNames(this._exposedInstance);
            // Register handlers for functions of service's Implementation (except the ones inherited from EventEmitter)
            // Looking in legacy class
            for (let [methodName, methodDesc] of methodNames) {
                this.registerCallHandler(methodName, methodDesc.value);
            }
        }
        else {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' does NOT have an implementation`);
        }
    }

    // private _addListener(event: string, replyChannel: string) {
    //     const eventHandler = this._eventHandlers.get(event);
    //     if (eventHandler == null) {
    //         // Register callback
    //         // TODO
    //         this._eventHandlers.set(event, new Set([replyChannel]));
    //     }
    //     else {
    //         eventHandler.add(replyChannel);
    //     }
    // }

    // private _removeListener(event: string, replyChannel: string) {
    //     const eventHandler = this._eventHandlers.get(event);
    //     if (eventHandler == null) {
    //     }
    //     else {
    //         eventHandler.delete(replyChannel);
    //         if (eventHandler.size === 0) {
    //             this._eventHandlers.delete(event);
    //             // Unregister callback
    //             // TODO
    //         }
    //     }
    // }

    // private _broadcastEmit(event: string, ...args: any[]) {
    //     const eventHandler = this._eventHandlers.get(event);
    //     if (eventHandler) {
    //         eventHandler.forEach((replyChannel) => {
    //             this._ipcBusClient.send(replyChannel, event, args);
    //         });
    //     }
    // }

    private _getServiceStatus(): Service.ServiceStatus {
        const callChannel = ServiceUtils.getServiceCallChannel(this._serviceName);
        const serviceStatus: Service.ServiceStatus = {
            started: this._ipcBusClient.listenerCount(callChannel) > 0,
            callHandlers: this._getCallHandlerNames(),
            supportEventEmitter: (this._prevImplEmit != null)
        };
        return serviceStatus;
    }

    start(): void {
        if (this._exposedInstance && this._exposedInstance['emit']) {
            // Hook events emitted by implementation to send them via IPC
            this._prevImplEmit = this._exposedInstance['emit'];
            this._exposedInstance['emit'] = (eventName: string, ...args: any[]) => {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is emitting event '${eventName}'`);

                // Emit the event on IPC
                this.sendEvent(ServiceUtils.IPCBUS_SERVICE_WRAPPER_EVENT, eventName, args);
                // Emit the event as usual in the context of the _exposedInstance
                this._prevImplEmit.call(this._exposedInstance, eventName, ...args);
            };

            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' will send events emitted by its implementation`);
        }

        // Listening to call messages
        // Manage re-entrance
        const callChannel = ServiceUtils.getServiceCallChannel(this._serviceName);
        this._ipcBusClient.removeListener(callChannel, this._onCallReceived);
        this._ipcBusClient.addListener(callChannel, this._onCallReceived);

        // The service is started, send available call handlers to clients
        this.sendEvent(Service.IPCBUS_SERVICE_EVENT_START, this._getServiceStatus());

        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is STARTED`);
    }

    stop(): void {
        if (this._exposedInstance && this._prevImplEmit) {
            // Unhook events emitted by implementation to send them via IPC
            this._exposedInstance['emit'] = this._prevImplEmit;
            this._prevImplEmit = null;
        }

        // The service is stopped
        this.sendEvent(Service.IPCBUS_SERVICE_EVENT_STOP, {});

        // No more listening to call messages
        const callChannel = ServiceUtils.getServiceCallChannel(this._serviceName);
        this._ipcBusClient.removeListener(callChannel, this._onCallReceived);

        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is STOPPED`);
    }

    registerCallHandler(name: string, handler: Function): void {
        this._callHandlers.set(name, handler);
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' registered call handler '${name}'`);
    }

    unregisterCallHandler(name: string): void {
        this._callHandlers.delete(name);
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' unregistered call handler '${name}'`);
    }

    sendEvent(name: string, ...args: any[]): void {
        const eventMsg: ServiceUtils.IpcBusServiceEvent = { eventName: name, args: args };
        this._ipcBusClient.send(ServiceUtils.getServiceEventChannel(this._serviceName), eventMsg);
    }

    private _onCallReceived(event: Client.IpcBusEvent, call: ServiceUtils.IpcBusServiceCall) {
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is calling implementation's '${call.handlerName}'`);
        const callHandler: Function = this._callHandlers.get(call.handlerName);
        try {
            if (!callHandler) {
                throw `Function unknown !`;
            }
            else {
                const result = callHandler.apply(this._exposedInstance, call.args);
                if (event.request) {
                    if (result && result['then']) {
                        // result is a valid promise
                        result.then(event.request.resolve, event.request.reject);
                    }
                    else {
                        // result is "just" a value
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

    private _getCallHandlerNames(): Array<string> {
        // Remove __getServiceStatus and any internal hidden functions
        const callHandlerNames = Array.from(this._callHandlers.keys()).filter((name) => name[0] !== '_');
        return callHandlerNames;
    }
}