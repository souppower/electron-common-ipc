import { IpcTimeoutOptions, IpcNetOptions } from '../IpcBusClient';

export namespace IpcBusBridge {
    export interface ConnectOptions extends IpcTimeoutOptions, IpcNetOptions {
    }
    export interface ConnectFunction {
        (options: ConnectOptions): Promise<void>;
        (port: number, hostname?: string): Promise<void>;
        (path: string): Promise<void>;
    }

    export interface CloseOptions extends IpcTimeoutOptions {
    }
    export interface CloseFunction {
        (options?: IpcBusBridge.CloseOptions): Promise<void>;
    }

    export interface CreateFunction {
        (): IpcBusBridge | null ;
    }
    export let Create: CreateFunction;
}

export interface IpcBusBridge {
    connect: IpcBusBridge.ConnectFunction;
    close: IpcBusBridge.CloseFunction;
}
