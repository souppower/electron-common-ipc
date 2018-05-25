/// <reference types='node' />

import { EventEmitter } from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';


class CallWrapperEventEmitter extends EventEmitter {
    [key: string]: Function;
}

// Implementation of IPC service
/** @internal */
export class IpcBusServiceProxyImpl extends EventEmitter implements IpcBusInterfaces.IpcBusServiceProxy {
    private _eventReceivedLamdba: IpcBusInterfaces.IpcBusListener = (event: IpcBusInterfaces.IpcBusEvent, ...args: any[]) => this._onEventReceived(event, <IpcBusInterfaces.IpcBusServiceEvent>args[0]);
    private _delayedCalls = new Array<Function>();
    private _isStarted: boolean;
    private _wrapper: CallWrapperEventEmitter = null;
    private _ipcBusClient: IpcBusInterfaces.IpcBusClient;
    private _serviceName: string;
    private _callTimeout: number;

    constructor(ipcBusClient: IpcBusInterfaces.IpcBusClient, serviceName: string, callTimeout: number = IpcBusUtils.IPC_BUS_TIMEOUT) {
        super();
        super.setMaxListeners(0);

        this._ipcBusClient = ipcBusClient;
        this._serviceName = serviceName;
        this._callTimeout = callTimeout;

        this._wrapper = new CallWrapperEventEmitter();

        // Check service availability
        this._isStarted = false;

        this.getStatus()
          .then((serviceStatus: IpcBusInterfaces.ServiceStatus) => {
                if (!this._isStarted && serviceStatus.started) {
                    // Service is started
                    this._onServiceStart(serviceStatus);
                }
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
            options.timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
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

    private _call<T>(name: string, ...args: any[]): Promise<T> {
        const callMsg = { handlerName: name, args: args };
        return this._ipcBusClient.request(IpcBusUtils.getServiceCallChannel(this._serviceName), this._callTimeout, callMsg)
            .then((res: IpcBusInterfaces.IpcBusRequestResponse) => {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] resolve call to '${name}' from service '${this._serviceName}' - res: ${JSON.stringify(res)}`);
                return <T>res.payload;
            })
            .catch((res: IpcBusInterfaces.IpcBusRequestResponse) => {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] reject call to '${name}' from service '${this._serviceName}' - res: ${JSON.stringify(res)}`);
                throw res.err;
            });
    }

    private call<T>(name: string, ...args: any[]): Promise<T> {
        if (this._isStarted) {
            return this._call(name, ...args);
        }
        return new Promise<T>((resolve, reject) => {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Call to '${name}' from service '${this._serviceName}' delayed as the service is not available`);
            const delayedCall = () => {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Executing delayed call to '${name}' from service '${this._serviceName}' ...`);
                this._call(name, ...args)
                .then((res: T) => resolve(res))
                .catch((err: any) => reject(err));
            };
            this._delayedCalls.push(delayedCall);
        });
    }

    private _updateWrapper(serviceStatus: IpcBusInterfaces.ServiceStatus): void {
        for (let i = 0, l = serviceStatus.callHandlers.length; i < l; ++i) {
            let handlerName = serviceStatus.callHandlers[i];
            const proc = (...args: any[]) => {
                return this.call<Object>(handlerName, ...args);
            };
            this._wrapper[handlerName] = proc;
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' added '${handlerName}' to its wrapper`);
        }
    }

    private _sendDelayedCalls(): void {
        for (let i = 0, l = this._delayedCalls.length; i < l; ++i) {
            this._delayedCalls[i]();
        }
        this._delayedCalls.splice(0, this._delayedCalls.length);
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
        this._isStarted = serviceStatus.started;
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is STARTED`);
        this._updateWrapper(serviceStatus);
        this.emit(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_START, serviceStatus);

        this._sendDelayedCalls();
    }

    private _onServiceStop() {
        this._isStarted = false;
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is STOPPED`);
        this.emit(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_STOP);
    }
}