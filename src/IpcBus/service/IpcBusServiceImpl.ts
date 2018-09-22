/// <reference types='node' />

import { EventEmitter } from 'events';
import * as IpcBusClientInterfaces from '../IpcBusClientInterfaces';
import * as IpcBusServiceInterfaces from './IpcBusServiceInterfaces';

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
    let methodNames = new Map<string, PropertyDescriptor>();

    Object.getOwnPropertyNames(obj)
        .forEach(name => {
            let desc = hasMethod(obj, name);
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
                let desc = hasMethod(proto, name);
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
export class IpcBusServiceImpl implements IpcBusServiceInterfaces.IpcBusService {
    private _callHandlers: Map<string, IpcBusServiceInterfaces.IpcBusServiceCallHandler>;
    private _callReceivedLamdba: IpcBusClientInterfaces.IpcBusListener = (event: IpcBusClientInterfaces.IpcBusEvent, ...args: any[]) => this._onCallReceived(event, <IpcBusServiceInterfaces.IpcBusServiceCall>args[0]);
    private _prevImplEmit: Function = null;

    constructor(private _ipcBusClient: IpcBusClientInterfaces.IpcBusClient, private _serviceName: string, private _exposedInstance: any, options?: IpcBusServiceInterfaces.IpcBusService.CreateOptions) {
        this._callHandlers = new Map<string, IpcBusServiceInterfaces.IpcBusServiceCallHandler>();

        //  Register internal call handlers
        this.registerCallHandler(IpcBusUtils.IPCBUS_SERVICE_CALL_GETSTATUS, (event: IpcBusClientInterfaces.IpcBusEvent, call: IpcBusServiceInterfaces.IpcBusServiceCall) => {
            let serviceStatus: IpcBusServiceInterfaces.ServiceStatus = {
                started: true,
                callHandlers: this._getCallHandlerNames(),
                supportEventEmitter: (this._prevImplEmit != null)
            };
            event.request.resolve(serviceStatus);
        });

        //  Register call handlers for exposed instance's method
        if (this._exposedInstance) {
            let methodNames = getInstanceMethodNames(this._exposedInstance);
            // Register handlers for functions of service's Implementation (except the ones inherited from EventEmitter)
            // Looking in legacy class
            methodNames.forEach((methodDesc, methodName) => {
                this.registerCallHandler(methodName,
                    (event: IpcBusClientInterfaces.IpcBusEvent, call: IpcBusServiceInterfaces.IpcBusServiceCall) => this._doCall(methodDesc.value, event, call));
            });
        }
        else {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' does NOT have an implementation`);
        }
    }

    start(): void {
        if (this._exposedInstance && this._exposedInstance['emit']) {
            // Hook events emitted by implementation to send them via IPC
            this._prevImplEmit = this._exposedInstance['emit'];
            this._exposedInstance['emit'] = (eventName: string, ...args: any[]) => {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is emitting event '${eventName}'`);

                // Emit the event on IPC
                this.sendEvent(IpcBusUtils.IPCBUS_SERVICE_WRAPPER_EVENT, eventName, args);
                // Emit the event as usual in the context of the _exposedInstance
                this._prevImplEmit.call(this._exposedInstance, eventName, ...args);
            };

            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' will send events emitted by its implementation`);
        }

        // Listening to call messages
        this._ipcBusClient.addListener(IpcBusUtils.getServiceCallChannel(this._serviceName), this._callReceivedLamdba);

        // The service is started, send available call handlers to clients
        let serviceStatus: IpcBusServiceInterfaces.ServiceStatus = {
            started: true,
            callHandlers: this._getCallHandlerNames(),
            supportEventEmitter: (this._prevImplEmit != null)
        };
        this.sendEvent(IpcBusClientInterfaces.IPCBUS_SERVICE_EVENT_START, serviceStatus);

        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is STARTED`);
    }

    stop(): void {
        if (this._exposedInstance && this._prevImplEmit) {
            // Unhook events emitted by implementation to send them via IPC
            this._exposedInstance['emit'] = this._prevImplEmit;
            this._prevImplEmit = null;
        }

        // The service is stopped
        this.sendEvent(IpcBusClientInterfaces.IPCBUS_SERVICE_EVENT_STOP, {});

        // No more listening to call messages
        this._ipcBusClient.removeListener(IpcBusUtils.getServiceCallChannel(this._serviceName), this._callReceivedLamdba);

        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is STOPPED`);
    }

    registerCallHandler(name: string, handler: IpcBusServiceInterfaces.IpcBusServiceCallHandler): void {
        this._callHandlers.set(name, handler);
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' registered call handler '${name}'`);
    }

    unregisterCallHandler(name: string): void {
        this._callHandlers.delete(name);
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' unregistered call handler '${name}'`);
    }

    sendEvent(name: string, ...args: any[]): void {
        const eventMsg = { eventName: name, args: args };
        this._ipcBusClient.send(IpcBusUtils.getServiceEventChannel(this._serviceName), eventMsg);
    }

    private _onCallReceived(event: IpcBusClientInterfaces.IpcBusEvent, msg: IpcBusServiceInterfaces.IpcBusServiceCall) {
        let callHandler: IpcBusServiceInterfaces.IpcBusServiceCallHandler = this._callHandlers.get(msg.handlerName);
        if (!callHandler) {
            event.request.reject(`Service '${this._serviceName}' does NOT handle calls to '${msg.handlerName}' !`);
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' does NOT handle calls to '${msg.handlerName}' !`);
        }
        else {
            try {
                callHandler(event, msg);
            }
            catch (e) {
                event.request.reject(e);
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' encountered an exception while processing call to '${msg.handlerName}' : ${e}`);
            }
        }
    }

    private _doCall(fct: Function, event: IpcBusClientInterfaces.IpcBusEvent, call: IpcBusServiceInterfaces.IpcBusServiceCall) {
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is calling implementation's '${call.handlerName}'`);
        if (event.request) {
            try {
                const result = fct.apply(this._exposedInstance, call.args);
                if (result && result['then']) {
                    // result is a valid promise
                    result.then(event.request.resolve, event.request.reject);
                }
                else {
                    // result is "just" a value
                    event.request.resolve(result);
                }
            }
            catch (e) {
                event.request.reject(e);
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' encountered an exception while processing request to '${call.handlerName}' : ${e}`);
            }
        }
        else {
            try {
                this._exposedInstance[call.handlerName](...call.args);
            }
            catch (e) {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' encountered an exception while processing call to '${call.handlerName}' : ${e}`);
            }
        }
    }

    private _getCallHandlerNames(): Array<string> {
        // Remove __getServiceStatus and any internal hidden functions
        const callHandlerNames = Array.from(this._callHandlers.keys()).filter((name) => name[0] !== '_');
        return callHandlerNames;
    }
}