import { IpcTimeoutOptions, IpcConnectOptions, IpcConnectFunction } from '../IpcBusClient';

export namespace IpcBusBridge {
    export interface ConnectOptions extends IpcConnectOptions {
    }
    export interface ConnectFunction extends IpcConnectFunction<IpcBusBridge.ConnectOptions> {
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
