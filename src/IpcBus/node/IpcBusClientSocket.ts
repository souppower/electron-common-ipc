import type { IpcBusClient } from '../IpcBusClient';

export namespace IpcBusClientNet {
    export let Create: IpcBusClient.CreateFunction;
}

export namespace IpcBusClientSocket {
    export let Create: IpcBusClient.CreateFunction;
}
