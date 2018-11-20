import * as Client from './IpcBusClient';

import { IpcBusClientTransportNet } from './IpcBusClientTransportNet';

// Implementation for Node process
/** @internal */
export class IpcBusClientMain extends IpcBusClientTransportNet {

    constructor(options: Client.IpcBusClient.CreateOptions) {
        super('main', options);
    }
}
