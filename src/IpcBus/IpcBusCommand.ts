import { IpcBusPeer } from './IpcBusClient';

/** @internal */
export namespace IpcBusCommand {
    /** @internal */
    export enum Kind {
        Handshake                   = 'HAN',
        Shutdown                    = 'SHT',
        Connect                     = 'COO',    // Obsolete
        Close                       = 'COC',    // Obsolete
        AddChannelListener          = 'LICA',
        RemoveChannelListener       = 'LICR',
        RemoveChannelAllListeners   = 'LICRA',
        RemoveListeners             = 'LIR',
        SendMessage                 = 'MES',
        RequestResponse             = 'RQR',
        RequestClose                = 'RQC',

        Log                         = 'LOG',

        BridgeConnect               = 'BCOO',    // COnnexion
        BridgeClose                 = 'BCOC',
    };

    /** @internal */
    export interface Request {
        channel: string;
        replyChannel: string;
        resolve?: boolean;
        reject?: boolean;
    }

    /** @internal */
    export interface Log {
        sent?: { 
            id: string;
            timestamp: number;
        }
        received?: {
            command: IpcBusCommand
        };
    }
}

/** @internal */
export interface IpcBusCommand {
    peer: IpcBusPeer;
    kind: IpcBusCommand.Kind;
    channel: string;
    request?: IpcBusCommand.Request;
    log?: IpcBusCommand.Log;
    bridge?: boolean;
}
