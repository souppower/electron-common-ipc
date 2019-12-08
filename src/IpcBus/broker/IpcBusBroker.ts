import { IpcTimeoutOptions, IpcNetOptions } from '../IpcBusClient';

export namespace IpcBusBroker {
    export interface ConnectOptions extends IpcTimeoutOptions, IpcNetOptions {
    }
    export interface ConnectFunction {
        (options?: IpcBusBroker.ConnectOptions): Promise<void>;
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
