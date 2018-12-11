import { EventEmitter } from 'events';

import { IpcBusClient, IpcTimeoutOptions } from '../IpcBusClient';

// Special events
export const IPCBUS_SERVICE_EVENT_START = 'service-event-start';
export const IPCBUS_SERVICE_EVENT_STOP = 'service-event-stop';

export interface ServiceStatus {
    started: boolean;
    callHandlers: string[];
    supportEventEmitter: boolean;
}

export namespace IpcBusService {
    export interface CreateOptions {
        depth?: number;
    }

    export interface CreateFunction {
       (client: IpcBusClient, serviceName: string, serviceImpl: any, options?: CreateOptions): IpcBusService | null ;
    }

    export let Create: CreateFunction;
}

export interface IpcBusService {
    start(): void;
    stop(): void;
    registerCallHandler(name: string, handler: Function): void;
    sendEvent(eventName: string, ...args: any[]): void;
}

export namespace IpcBusServiceProxy {
    export interface ConnectOptions extends IpcTimeoutOptions {
    }

    export interface CreateOptions extends IpcTimeoutOptions {
    }

    export interface CreateFunction {
        (client: IpcBusClient, serviceName: string, options?: CreateOptions): IpcBusServiceProxy | null ;
    }

    export let Create: CreateFunction;
}

export interface IpcBusServiceProxy extends EventEmitter {
    readonly isStarted: boolean;
    readonly wrapper: Object;

    connect<T>(options?: IpcBusServiceProxy.ConnectOptions): Promise<T>;
    getStatus(): Promise<ServiceStatus>;
    getWrapper<T>(): T;

    // Kept for backward
    call<T>(name: string, ...args: any[]): Promise<T>;
    apply<T>(name: string, args?: any[]): Promise<T>;

    // Do wait for the stub response, equivalent to call/apply.
    requestCall<T>(name: string, ...args: any[]): Promise<T>;
    requestApply<T>(name: string, args?: any[]): Promise<T>;

    // Do not wait for the stub response, more efficient.
    sendCall(name: string, ...args: any[]): void;
    sendApply(name: string, args?: any[]): void;

    // onServiceStart(handler: () => void);
    // onServiceStop(handler: () => void);
}
