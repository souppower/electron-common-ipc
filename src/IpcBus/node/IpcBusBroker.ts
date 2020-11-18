import type { IpcTimeoutOptions, IpcConnectOptions } from '../IpcBusClient';

export namespace IpcBusBroker {
    export interface ConnectOptions extends IpcConnectOptions {
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
        (options?: IpcBusBroker.CloseOptions): Promise<void>;
    }

    export interface CreateFunction {
        (): IpcBusBroker | null;
    }
    export let Create: CreateFunction;
}

export interface IpcBusBroker {
    connect: IpcBusBroker.ConnectFunction;
    close: IpcBusBroker.CloseFunction;
    queryState(): Object;
}
