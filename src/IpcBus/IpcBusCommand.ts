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
        AddChannelListener          = 'LICA',
        RemoveChannelListener       = 'LICR',
        RemoveChannelAllListeners   = 'LICRA',
        RemoveListeners             = 'LIR',
        SendMessage                 = 'MES',
        RequestResponse             = 'RQR',
        RequestClose                = 'RQC',

        BridgeConnect                     = 'BCOO',    // COnnexion
        BridgeClose                       = 'BCOC',

        // AddBrokerChannels                 = 'BOCAS',
        // RemoveBrokerChannels              = 'BOCRS',
        // AddBridgeChannels                 = 'BICAS',
        // RemoveBridgeChannels              = 'BICRS',
    };

    /** @internal */
    export interface Request {
        channel: string;
        replyChannel: string;
        resolve?: boolean;
        reject?: boolean;
    }

}
