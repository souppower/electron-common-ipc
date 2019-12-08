import { IpcTimeoutOptions, IpcConnectOptions, IpcConnectFunction } from '../IpcBusClient';

export namespace IpcBusBroker {
    export interface ConnectOptions extends IpcConnectOptions {
    }
    export interface ConnectFunction extends IpcConnectFunction<IpcBusBroker.ConnectOptions> {
    }

    export interface CloseOptions extends IpcTimeoutOptions {
    }
    export interface CloseFunction {
        (options?: IpcBusBroker.CloseOptions): Promise<void>;
    }

    export interface CreateFunction {
    }
    export let Create: CreateFunction;
}

export interface IpcBusBroker {
    connect: IpcBusBroker.ConnectFunction;
    close: IpcBusBroker.CloseFunction;
    queryState(): Object;
}
