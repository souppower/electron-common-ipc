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

    export interface CloseOptions {
        // not yet options
    }

    export interface CreateOptions extends IpcTimeoutOptions {
        rejectRequestWhenStopped?: boolean; // true by default
    }

    export interface CreateFunction {
        <T>(client: IpcBusClient, serviceName: string, options?: CreateOptions): IpcBusServiceProxy<T> | null ;
    }

    export let Create: CreateFunction;
}

export interface IpcBusServiceProxy<T> extends EventEmitter {
    readonly isStarted: boolean;
    readonly wrapper: Object;

    connect(options?: IpcBusServiceProxy.ConnectOptions): Promise<T>;
    close(options?: IpcBusServiceProxy.CloseOptions): Promise<void>;

    getStatus(): Promise<ServiceStatus>;
    getWrapper(): T;

    // Kept for backward
    call<R>(name: string, ...args: any[]): Promise<R>;
    apply<R>(name: string, args?: any[]): Promise<R>;

    // Do wait for the stub response, equivalent to call/apply.
    requestCall<R>(name: string, ...args: any[]): Promise<R>;
    requestApply<R>(name: string, args?: any[]): Promise<R>;

    // Do not wait for the stub response, more efficient.
    sendCall(name: string, ...args: any[]): void;
    sendApply(name: string, args?: any[]): void;

    // onServiceStart(handler: () => void);
    // onServiceStop(handler: () => void);
}
