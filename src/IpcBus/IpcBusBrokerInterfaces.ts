import { IpcTimeoutOptions, IpcNetOptions } from './IpcBusClientInterfaces';

export namespace IpcBusBroker {
    export interface StartOptions extends IpcTimeoutOptions {
    }

    export interface StopOptions extends IpcTimeoutOptions {
    }

    export interface CreateOptions extends IpcNetOptions {
    }

    export interface CreateFunction {
        (options: CreateOptions): IpcBusBroker | null ;
        (port: number, hostname?: string): IpcBusBroker | null ;
        (path: string): IpcBusBroker | null ;
    }
}

export interface IpcBusBroker {
    start(options?: IpcBusBroker.StartOptions): Promise<void>;
    stop(options?: IpcBusBroker.StopOptions): Promise<void>;
    queryState(): Object;
}
