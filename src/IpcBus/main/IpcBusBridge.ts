import type { IpcTimeoutOptions, IpcConnectOptions } from '../IpcBusClient';

export namespace IpcBusBridge {
    export interface ConnectOptions extends IpcConnectOptions {
        server?: boolean;
    }
    export interface ConnectFunction {
        (options: ConnectOptions): Promise<void>;
        (path: string, options?: ConnectOptions): Promise<void>;
        (port: number, options?: ConnectOptions): Promise<void>;
        (port: number, hostname?: string, options?: ConnectOptions): Promise<void>;
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
