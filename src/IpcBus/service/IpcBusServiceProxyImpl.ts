/// <reference types='node' />

import { EventEmitter } from 'events';
import * as Client from '../IpcBusClient';
import * as Service from './IpcBusService';
import * as ServiceUtils from './IpcBusServiceUtils';

import * as IpcBusUtils from '../IpcBusUtils';

/** @internal */
class Deferred<T> {
    private static _globalCounter: number = 0;

    public promise: Promise<T>;

    public resolve: (t: T) => void;
    public reject: (err: string) => void;
    public id: number;

    private _executor: Function;

    constructor(executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void)  => void, immediat: boolean = true) {
        this.id = ++Deferred._globalCounter;
        this.promise = new Promise<T>((resolve, reject) => {
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

    public execute() {
        if (this._executor) {
            this._executor(this.resolve, this.reject);
        }
    }

    public then(...args: any[]): any {
        return this.promise.then(...args);
    }

    public catch(...args: any[]): any {
        return this.promise.catch(...args);
    }
}

class CallWrapperEventEmitter extends EventEmitter {
    [key: string]: Function;
}

// Implementation of IPC service
/** @internal */
export class IpcBusServiceProxyImpl extends EventEmitter implements Service.IpcBusServiceProxy {
    private _onServiceReceivedLambda: Client.IpcBusListener = (event: Client.IpcBusEvent, ...args: any[]) => this._onServiceReceived(event, <ServiceUtils.IpcBusServiceEvent>args[0]);
    private _isStarted: boolean;
    private _wrapper: CallWrapperEventEmitter;
    private _ipcBusClient: Client.IpcBusClient;
    private _serviceName: string;
    private _options: Service.IpcBusServiceProxy.CreateOptions;

    private _pendingCalls: Map<number, Deferred<any>>;

    constructor(ipcBusClient: Client.IpcBusClient, serviceName: string, options?: Service.IpcBusServiceProxy.CreateOptions) {
        super();
        super.setMaxListeners(0);

        this._ipcBusClient = ipcBusClient;
        this._serviceName = serviceName;

        options = options || {};
        options.timeoutDelay = options.timeoutDelay || IpcBusUtils.IPC_BUS_TIMEOUT;
        this._options = options;

        this._pendingCalls = new Map<number, Deferred<any>>();
        this._wrapper = new CallWrapperEventEmitter();

        // Check service availability
        this._isStarted = false;

        this.getStatus()
          .then((serviceStatus: Service.ServiceStatus) => {
                this._onServiceStart(serviceStatus);
            })
            // DeprecationWarning: Unhandled promise rejections are deprecated
            .catch((err) => {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] first status to '${this._serviceName}' - err: ${err}`);
            });

        // Register service start/stop/event events
        this._ipcBusClient.addListener(ServiceUtils.getServiceEventChannel(this._serviceName), this._onServiceReceivedLambda);
    }

    connect<T>(options?: Service.IpcBusServiceProxy.ConnectOptions): Promise<T> {
        options = options || {};
        if (options.timeoutDelay == null) {
            options.timeoutDelay = this._options.timeoutDelay;
        }
        return new Promise<T>((resolve, reject) => {
            if (this._isStarted) {
                return resolve(this.getWrapper<T>());
            }
            let timer: NodeJS.Timer;
            // Below zero = infinite
            if (options.timeoutDelay >= 0) {
                timer = setTimeout(() => {
                    this.removeListener(Service.IPCBUS_SERVICE_EVENT_START, serviceStart);
                    reject('timeout');
                }, options.timeoutDelay);
            }
            let serviceStart = () => {
                clearTimeout(timer);
                this.removeListener(Service.IPCBUS_SERVICE_EVENT_START, serviceStart);
                resolve(this.getWrapper<T>());
            };
            this.on(Service.IPCBUS_SERVICE_EVENT_START, serviceStart);
        });
    }

    get isStarted(): boolean {
        return this._isStarted;
    }

    getWrapper<T>(): T {
        const typed_wrapper: any = this._wrapper;
        return <T>typed_wrapper;
    }

    get wrapper(): Object {
        return this._wrapper;
    }

    getStatus(): Promise<Service.ServiceStatus> {
        return this._call<Service.ServiceStatus>(ServiceUtils.IPCBUS_SERVICE_CALL_GETSTATUS);
    }

    private _requestApply<T>(name: string, args?: any[]): Deferred<T> {
        let deferred = new Deferred<T>((resolve, reject) => {
            const callMsg = { handlerName: name, args: args };
            this._ipcBusClient.request(ServiceUtils.getServiceCallChannel(this._serviceName), -1, callMsg)
                .then((res: Client.IpcBusRequestResponse) => {
                    IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] resolve call to '${name}' from service '${this._serviceName}' - res: ${JSON.stringify(res)}`);
                    this._pendingCalls.delete(deferred.id);
                    resolve(<T>res.payload);
                })
                .catch((res: Client.IpcBusRequestResponse) => {
                    IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] reject call to '${name}' from service '${this._serviceName}' - res: ${JSON.stringify(res)}`);
                    this._pendingCalls.delete(deferred.id);
                    reject(res.err);
                });
        }, false);
        this._pendingCalls.set(deferred.id, deferred);
        return deferred;
    }

    private _call<T>(name: string, ...args: any[]): Promise<T> {
        let deferred = this._requestApply<T>(name, args);
        deferred.execute();
        return deferred.promise;
    }

    requestApply<T>(name: string, args?: any[]): Promise<T> {
        let deferred = this._requestApply<T>(name, args);
        if (this._isStarted) {
            deferred.execute();
        }
        else {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] call delayed '${name}' from service '${this._serviceName}'`);
        }
        return deferred.promise;
    }

    requestCall<T>(name: string, ...args: any[]): Promise<T> {
        return this.requestApply(name, args);
    }

    apply<T>(name: string, args?: any[]): Promise<T> {
        return this.requestApply(name, args);
    }

    call<T>(name: string, ...args: any[]): Promise<T> {
        return this.requestApply(name, args);
    }

    private _sendApply(name: string, args?: any[]): Deferred<void> {
        let deferred = new Deferred<void>((resolve, reject) => {
            const callMsg = { handlerName: name, args: args };
            this._ipcBusClient.send(ServiceUtils.getServiceCallChannel(this._serviceName), -1, callMsg);
            this._pendingCalls.delete(deferred.id);
        }, false);
        this._pendingCalls.set(deferred.id, deferred);
        return deferred;
    }

    sendApply(name: string, args?: any[]): void {
        if (this._isStarted) {
            const callMsg = { handlerName: name, args: args };
            this._ipcBusClient.send(ServiceUtils.getServiceCallChannel(this._serviceName), -1, callMsg);
        }
        else {
            this._sendApply(name, args);
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] call delayed '${name}' from service '${this._serviceName}'`);
        }
    }

    sendCall(name: string, ...args: any[]): void {
        return this.sendApply(name, args);
    }

    private _updateWrapper(serviceStatus: Service.ServiceStatus): void {
        for (let i = 0, l = serviceStatus.callHandlers.length; i < l; ++i) {
            let handlerName = serviceStatus.callHandlers[i];
            const requestProc = (...args: any[]) => {
                return this.requestApply<Object>(handlerName, args);
            };
            const sendProc = (...args: any[]) => {
                return this.sendApply(handlerName, args);
            };
            this._wrapper[handlerName] = requestProc;
            this._wrapper[`request_${handlerName}`] = requestProc;
            this._wrapper[`send_${handlerName}`] = sendProc;
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' added '${handlerName}' to its wrapper`);
        }
    }

    private _onServiceReceived(event: Client.IpcBusEvent, msg: ServiceUtils.IpcBusServiceEvent) {
        if (msg.eventName === ServiceUtils.IPCBUS_SERVICE_WRAPPER_EVENT) {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Wrapper '${this._serviceName}' receive event '${msg.args[0]}'`);
            this._wrapper.emit(msg.args[0], ...msg.args[1]);
        }
        else {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' receive event '${msg.eventName}'`);
            switch (msg.eventName) {
                case Service.IPCBUS_SERVICE_EVENT_START:
                    this._onServiceStart(msg.args[0] as Service.ServiceStatus);
                    break;
                case Service.IPCBUS_SERVICE_EVENT_STOP:
                    this._onServiceStop();
                    break;
                default :
                    this.emit(msg.eventName, ...msg.args);
                    break;
            }
        }
    }

    private _onServiceStart(serviceStatus: Service.ServiceStatus) {
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

    private _onServiceStop() {
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