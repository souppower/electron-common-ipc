import type { IpcBusPeer } from './IpcBusClient';

/** @internal */
export namespace IpcBusCommand {
    export const KindBridgePrefix = 'B';
    
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

        LogGetMessage               = 'LOGGET',
        LogLocalSendRequest         = 'LOGMES',
        LogLocalRequestResponse     = 'LOGRQR',

        BridgeConnect               = 'BCOO',    // COnnexion
        BridgeClose                 = 'BCOC',
        BridgeAddChannelListener    = 'BLICA',
        BridgeRemoveChannelListener = 'BLICR',
    };

    /** @internal */
    export interface Request {
        channel: string;
        replyChannel: string;
        resolve?: boolean;
        reject?: boolean;
    }

    /** @internal */
    export interface LogCommand {
        peer: IpcBusPeer;
        kind: IpcBusCommand.Kind;
        channel: string;
        channels?: string[];
        request?: IpcBusCommand.Request;
    }

    /** @internal */
    export interface Log {
        id: string;
        peer: IpcBusPeer;
        related_peer?: IpcBusPeer;
        kind: IpcBusCommand.Kind;
        timestamp: number;
        local?: boolean;
        command?: IpcBusCommand.LogCommand;
        previous?: Log;
    }
}

/** @internal */
export interface IpcBusCommand {
    peer: IpcBusPeer;

    kind: IpcBusCommand.Kind;
    channel: string;
    channels?: string[];
    request?: IpcBusCommand.Request;
    log?: IpcBusCommand.Log;
}
