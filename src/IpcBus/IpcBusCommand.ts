import { IpcBusPeer } from './IpcBusInterfaces';

/** @internal */
export class IpcBusCommand {
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
        RequestMessage              = 'RQM',    // ReQuest
        RequestResponse             = 'RQR',
        RequestCancel               = 'RQC'
    };

    /** @internal */
    export class Request {
        replyChannel: string;
        resolve?: boolean;
        reject?: boolean;
    }

}
