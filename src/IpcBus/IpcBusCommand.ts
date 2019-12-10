import { IpcBusPeer } from './IpcBusClient';

/** @internal */
export interface IpcBusCommand {
    kind: IpcBusCommand.Kind;
    channel: string;
    peer: IpcBusPeer;
    request?: IpcBusCommand.Request;
}

/** @internal */
export namespace IpcBusCommand {
    /** @internal */
    export enum Kind {
        Connect                     = 'COO',    // COnnexion
        Disconnect                  = 'COD',
        Close                       = 'COC',
        AddChannelListener          = 'LICA',   // LIstener
        RemoveChannelListener       = 'LICR',
        RemoveChannelAllListeners   = 'LICRA',
        RemoveListeners             = 'LIR',
        SendMessage                 = 'MES',    // MEssage
        RequestResponse             = 'RQR',
        RequestCancel               = 'RQC',

        BridgeConnect                     = 'BCOO',    // COnnexion
        BridgeDisconnect                  = 'BCOD',
        BridgeClose                       = 'BCOC',
        BridgeAddChannelListener          = 'BLICA',   // LIstener
        BridgeRemoveChannelListener       = 'BLICR',
        BridgeRemoveChannelAllListeners   = 'BLICRA',
        BridgeRemoveListeners             = 'BLIR',
        BridgeSendMessage                 = 'BMES',    // MEssage
        BridgeRequestResponse             = 'BRQR',
        BridgeRequestCancel               = 'BRQC',

        BrokerAddChannels                 = 'BOCAS',
        BrokerRemoveChannels              = 'BOCRS',
        BridgeAddChannels                 = 'BICAS',
        BridgeRemoveChannels              = 'BICRS',
    };

    /** @internal */
    export interface Request {
        channel: string;
        replyChannel: string;
        resolve?: boolean;
        reject?: boolean;
    }

}
