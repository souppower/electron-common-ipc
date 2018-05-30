/// <reference types='node' />

import { EventEmitter } from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

/** @internal */
export class Deferred<T> {
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
export class IpcBusServiceProxyImpl extends EventEmitter implements IpcBusInterfaces.IpcBusServiceProxy {
    private _eventReceivedLamdba: IpcBusInterfaces.IpcBusListener = (event: IpcBusInterfaces.IpcBusEvent, ...args: any[]) => this._onEventReceived(event, <IpcBusInterfaces.IpcBusServiceEvent>args[0]);
    private _isStarted: boolean;
    private _wrapper: CallWrapperEventEmitter = null;
    private _ipcBusClient: IpcBusInterfaces.IpcBusClient;
    private _serviceName: string;
    private _callTimeout: number;

    private _pendingCalls: Map<number, Deferred<any>>;

    constructor(ipcBusClient: IpcBusInterfaces.IpcBusClient, serviceName: string, callTimeout: number = IpcBusUtils.IPC_BUS_TIMEOUT) {
        super();
        super.setMaxListeners(0);

        this._pendingCalls = new Map<number, Deferred<any>>();

        this._ipcBusClient = ipcBusClient;
        this._serviceName = serviceName;
        this._callTimeout = callTimeout;

        this._wrapper = new CallWrapperEventEmitter();

        // Check service availability
        this._isStarted = false;

        this.getStatus()
          .then((serviceStatus: IpcBusInterfaces.ServiceStatus) => {
                this._onServiceStart(serviceStatus);
            })
            // DeprecationWarning: Unhandled promise rejections are deprecated
            .catch((err) => {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] first status to '${this._serviceName}' - err: ${err}`);
            });

        // Register service start/stop/event events
        this._ipcBusClient.addListener(IpcBusUtils.getServiceEventChannel(this._serviceName), this._eventReceivedLamdba);
    }

    connect<T>(options?: IpcBusInterfaces.IpcBusServiceProxy.ConnectOptions): Promise<T> {
        options = options || {};
        if (options.timeoutDelay == null) {
            options.timeoutDelay = this._callTimeout;
        }
        return new Promise<T>((resolve, reject) => {
            if (this._isStarted) {
                return resolve(this.getWrapper<T>());
            }
            let timer: NodeJS.Timer;
            // Below zero = infinite
            if (options.timeoutDelay >= 0) {
                timer = setTimeout(() => {
                    this.removeListener(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_START, serviceStart);
                    reject('timeout');
                }, options.timeoutDelay);
            }
            let serviceStart = () => {
                clearTimeout(timer);
                this.removeListener(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_START, serviceStart);
                resolve(this.getWrapper<T>());
            };
            this.on(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_START, serviceStart);
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

    getStatus(): Promise<IpcBusInterfaces.ServiceStatus> {
        return this._call<IpcBusInterfaces.ServiceStatus>(IpcBusUtils.IPCBUS_SERVICE_CALL_GETSTATUS);
    }

    createCall<T>(name: string, args: any[]): Deferred<T> {
        let deferred = new Deferred<T>((resolve, reject) => {
            const callMsg = { handlerName: name, args: args };
            this._ipcBusClient.request(IpcBusUtils.getServiceCallChannel(this._serviceName), -1, callMsg)
                .then((res: IpcBusInterfaces.IpcBusRequestResponse) => {
                    IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] resolve call to '${name}' from service '${this._serviceName}' - res: ${JSON.stringify(res)}`);
                    this._pendingCalls.delete(deferred.id);
                    resolve(<T>res.payload);
                })
                .catch((res: IpcBusInterfaces.IpcBusRequestResponse) => {
                    IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] reject call to '${name}' from service '${this._serviceName}' - res: ${JSON.stringify(res)}`);
                    this._pendingCalls.delete(deferred.id);
                    reject(res.err);
                });
        }, false);
        this._pendingCalls.set(deferred.id, deferred);
        return deferred;
    }

    private _call<T>(name: string, ...args: any[]): Promise<T> {
        let deferred = this.createCall<T>(name, args);
        deferred.execute();
        return deferred.promise;
    }

    apply<T>(name: string, args: any[]): Promise<T> {
        let deferred = this.createCall<T>(name, args);
        if (this._isStarted) {
            deferred.execute();
        }
        else {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] call delayed '${name}' from service '${this._serviceName}'`);
        }
        return deferred.promise;
    }

    call<T>(name: string, ...args: any[]): Promise<T> {
        return this.apply(name, args);
    }

    private _updateWrapper(serviceStatus: IpcBusInterfaces.ServiceStatus): void {
        for (let i = 0, l = serviceStatus.callHandlers.length; i < l; ++i) {
            let handlerName = serviceStatus.callHandlers[i];
            const proc = (...args: any[]) => {
                return this.apply<Object>(handlerName, args);
            };
            this._wrapper[handlerName] = proc;
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' added '${handlerName}' to its wrapper`);
        }
    }

    private _onEventReceived(event: IpcBusInterfaces.IpcBusEvent, msg: IpcBusInterfaces.IpcBusServiceEvent) {
        if (msg.eventName === IpcBusUtils.IPCBUS_SERVICE_WRAPPER_EVENT) {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Wrapper '${this._serviceName}' receive event '${msg.args[0]}'`);
            this._wrapper.emit(msg.args[0], ...msg.args[1]);
        }
        else {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' receive event '${msg.eventName}'`);
            switch (msg.eventName) {
                case IpcBusInterfaces.IPCBUS_SERVICE_EVENT_START:
                    this._onServiceStart(msg.args[0] as IpcBusInterfaces.ServiceStatus);
                    break;
                case IpcBusInterfaces.IPCBUS_SERVICE_EVENT_STOP:
                    this._onServiceStop();
                    break;
                default :
                    this.emit(msg.eventName, ...msg.args);
                    break;
            }
        }
    }

    private _onServiceStart(serviceStatus: IpcBusInterfaces.ServiceStatus) {
        if (!this._isStarted && serviceStatus.started) {
            this._isStarted = true;
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is STARTED`);
            this._updateWrapper(serviceStatus);
            this.emit(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_START, serviceStatus);

            this._pendingCalls.forEach((deferred) => {
                deferred.execute();
            });
        }
    }

    private _onServiceStop() {
        if (this._isStarted) {
            this._isStarted = false;
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is STOPPED`);
            this.emit(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_STOP);

            this._pendingCalls.forEach((deferred) => {
                deferred.reject('service stopped');
            });
        }
    }
}