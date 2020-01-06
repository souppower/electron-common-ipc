import { IpcBusPeer } from './IpcBusClient';

/** @internal */
export interface IpcBusCommand {
    kind: IpcBusCommand.Kind;
    channel: string;
    peer: IpcBusPeer;
    request?: IpcBusCommand.Request;
    bridge?: boolean;
}

/** @internal */
export namespace IpcBusCommand {
    /** @internal */
    export enum Kind {
        Handshake                   = 'HAN',    // COnnexion
        Connect                     = 'COO',    // COnnexion
        Shutdown                    = 'SHT',
        Close                       = 'COC',
        AddChannelListener          = 'LICA',   // LIstener
        RemoveChannelListener       = 'LICR',
        RemoveChannelAllListeners   = 'LICRA',
        RemoveListeners             = 'LIR',
        SendMessage                 = 'MES',    // MEssage
        RequestResponse             = 'RQR',
        RequestCancel               = 'RQC',

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
