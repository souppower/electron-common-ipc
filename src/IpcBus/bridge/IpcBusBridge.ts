import { IpcTimeoutOptions, IpcNetOptions } from '../IpcBusClient';

export namespace IpcBusBridge {
    export interface StartOptions extends IpcTimeoutOptions {
    }

    export interface StopOptions extends IpcTimeoutOptions {
    }

    export interface CreateOptions extends IpcNetOptions {
    }

    export interface CreateFunction {
        (options: CreateOptions): IpcBusBridge | null ;
        (port: number, hostname?: string): IpcBusBridge | null ;
        (path: string): IpcBusBridge | null ;
    }
}

export interface IpcBusBridge {
    start(options?: IpcBusBridge.StartOptions): Promise<void>;
    stop(options?: IpcBusBridge.StopOptions): Promise<void>;
}
