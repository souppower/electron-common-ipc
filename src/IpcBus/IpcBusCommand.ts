import { IpcBusPeer } from './IpcBusInterfaces';

/** @internal */
export class IpcBusData {
    replyChannel?: string;
    resolve?: boolean;
    reject?: boolean;
}

/** @internal */
export class IpcBusCommand {
    kind: IpcBusCommand.Kind;
    channel: string;
    peer: IpcBusPeer;
    data?: IpcBusData;
}

/** @internal */
export namespace IpcBusCommand {
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
        RequestCancel               = 'RQC'
    };
}
