import { IpcBusPeer } from './IpcBusClient';

/** @internal */
export interface IpcBusCommand {
    kind: IpcBusCommand.Kind;
    channel: string;
    emit?: string;
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
        RequestMessage              = 'RQM',    // ReQuest
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
        BridgeRequestMessage              = 'BRQM',    // ReQuest
        BridgeRequestResponse             = 'BRQR',
        BridgeRequestCancel               = 'BRQC',
    };

    /** @internal */
    export interface Request {
        replyChannel: string;
        resolve?: boolean;
        reject?: boolean;
    }

}
