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
    private _ipcBusClient: Client.IpcBusClient;
    private _serviceName: string;
    private _options: Service.IpcBusServiceProxy.CreateOptions;

    private _wrapper: CallWrapperEventEmitter;
    private _connectCloseState: IpcBusUtils.ConnectCloseState<any>;
    private _isStarted: boolean;
    private _pendingCalls: Map<number, Deferred<any>>;

    constructor(ipcBusClient: Client.IpcBusClient, serviceName: string, options?: Service.IpcBusServiceProxy.CreateOptions) {
        super();
        super.setMaxListeners(0);

        this._ipcBusClient = ipcBusClient;
        this._serviceName = serviceName;

        options = options || {};
        options.timeoutDelay = options.timeoutDelay || IpcBusUtils.IPC_BUS_TIMEOUT;
        options.rejectRequestWhenStopped = options?.rejectRequestWhenStopped ?? true;
        this._options = options;

        this._isStarted = false;
        this._connectCloseState = new IpcBusUtils.ConnectCloseState<any>();

        this._pendingCalls = new Map<number, Deferred<any>>();
        this._wrapper = new CallWrapperEventEmitter();

        // Callback
        this._onServiceReceived = this._onServiceReceived.bind(this);
    }

    connect<R>(options?: Service.IpcBusServiceProxy.ConnectOptions): Promise<R> {
        return this._connectCloseState.connect(() => {
            return new Promise<R>((resolve, reject) => {
                options = options || {};
                if (options.timeoutDelay == null) {
                    options.timeoutDelay = this._options.timeoutDelay;
                }
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is connecting`);

                // Register service start/stop/event events
                const eventChannel = ServiceUtils.getServiceEventChannel(this._serviceName);
                // Remove in case of unlikely re-entrance
                this._ipcBusClient.removeListener(eventChannel, this._onServiceReceived);
                this._ipcBusClient.addListener(eventChannel, this._onServiceReceived);

                this._call<Service.ServiceStatus>(options.timeoutDelay, ServiceUtils.IPCBUS_SERVICE_CALL_GETSTATUS)
                .then((serviceStatus) => {
                    if (serviceStatus?.started) {
                        this._onServiceStart(serviceStatus);
                        return resolve(this.getWrapper<R>());
                    }
                    IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] first status to '${this._serviceName}' - not started`);
                    reject(new Error(`${this._serviceName} not started`));
                })
                // DeprecationWarning: Unhandled promise rejections are deprecated
                .catch((err) => {
                    IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] first status to '${this._serviceName}' - err: ${err}`);
                    reject(err);
                });
            });
        });
    }

    close(options?: Service.IpcBusServiceProxy.CloseOptions): Promise<void> {
        return this._connectCloseState.close(() => {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is closed`);
            const eventChannel = ServiceUtils.getServiceEventChannel(this._serviceName);
            this._ipcBusClient.removeListener(eventChannel, this._onServiceReceived);
            this._onServiceStop();
            return Promise.resolve();
        });
    }

    get isStarted(): boolean {
        return this._isStarted;
    }

    getWrapper<R>(): R {
        const typed_wrapper: any = this._wrapper;
        return <R> typed_wrapper;
    }

    get wrapper(): Object {
        return this._wrapper;
    }

    getStatus(): Promise<Service.ServiceStatus> {
        return this._call<Service.ServiceStatus>(this._options.timeoutDelay, ServiceUtils.IPCBUS_SERVICE_CALL_GETSTATUS);
    }

    private _requestApply<R>(timeout: number, name: string, args?: any[]): Deferred<R> {
        const deferred = new Deferred<R>((resolve, reject) => {
            const callMsg = { handlerName: name, args: args };
            this._ipcBusClient.request(ServiceUtils.getServiceCallChannel(this._serviceName), timeout, callMsg)
                .then((res: Client.IpcBusRequestResponse) => {
                    IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] resolve call to '${name}' from service '${this._serviceName}' - res: ${JSON.stringify(res)}`);
                    this._pendingCalls.delete(deferred.id);
                    resolve(<R>res.payload);
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

    private _call<R>(timeout: number, name: string, ...args: any[]): Promise<R> {
        const deferred = this._requestApply<R>(timeout, name, args);
        deferred.execute();
        return deferred.promise;
    }

    requestApply<R>(name: string, args?: any[]): Promise<R> {
        const deferred = this._requestApply<R>(this._options.timeoutDelay, name, args);
        if (this._isStarted) {
            deferred.execute();
        }
        else {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] call delayed '${name}' from service '${this._serviceName}'`);
        }
        return deferred.promise;
    }

    requestCall<R>(name: string, ...args: any[]): Promise<R> {
        return this.requestApply(name, args);
    }

    apply<R>(name: string, args?: any[]): Promise<R> {
        return this.requestApply(name, args);
    }

    call<R>(name: string, ...args: any[]): Promise<R> {
        return this.requestApply(name, args);
    }

    private _sendApply(name: string, args?: any[]): Deferred<void> {
        const deferred = new Deferred<void>((resolve, reject) => {
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
            const handlerName = serviceStatus.callHandlers[i];
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
            this.emit(msg.args[0], ...msg.args[1]);
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
        if (this._isStarted === false) {
            this._isStarted = true;
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is STARTED`);
            this._updateWrapper(serviceStatus);
            this.emit(Service.IPCBUS_SERVICE_EVENT_START, serviceStatus);

            for (let [, deferred] of this._pendingCalls) {
                deferred.execute();
            }
            this._pendingCalls.clear();
        }
    }

    private _onServiceStop() {
        if (this._isStarted) {
            this._isStarted = false;
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is STOPPED`);
            this.emit(Service.IPCBUS_SERVICE_EVENT_STOP);

            if (this._options.rejectRequestWhenStopped) {
                for (let [, deferred] of this._pendingCalls) {
                    deferred.reject(`Service '${this._serviceName}' stopped`);
                }
                this._pendingCalls.clear();
            }
        }
    }
}