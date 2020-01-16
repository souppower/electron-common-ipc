import { IpcBusPeer } from './IpcBusClient';

/** @internal */
export interface IpcBusCommand {
    peer: IpcBusPeer;
    kind: IpcBusCommand.Kind;
    channel: string;
    request?: IpcBusCommand.Request;
    bridge?: boolean;
}

/** @internal */
export namespace IpcBusCommand {
    /** @internal */
    export enum Kind {
        Handshake                   = 'HAN',
        Shutdown                    = 'SHT',
        Connect                     = 'COO',    // Obsolete
        Close                       = 'COC',    // Obsolete
        AddChannels                 = 'CHA',
        RemoveChannels              = 'CHR',
        AddChannelListener          = 'LICA',   // Obsolete
        RemoveChannelListener       = 'LICR',   // Obsolete
        RemoveChannelAllListeners   = 'LICRA',  // Obsolete
        RemoveListeners             = 'LIR',    // Obsolete
        SendMessage                 = 'MES',    // MEssage
        RequestResponse             = 'RQR',
        RequestClose                = 'RQC',

        BridgeConnect                     = 'BCOO',    // COnnexion
        BridgeClose                       = 'BCOC',

        AddBrokerChannels                 = 'BOCAS',
        RemoveBrokerChannels              = 'BOCRS',
        AddBridgeChannels                 = 'BICAS',
        RemoveBridgeChannels              = 'BICRS',
    };

    /** @internal */
    export interface Request {
        channel: string;
        replyChannel: string;
        resolve?: boolean;
        reject?: boolean;
    }

}
