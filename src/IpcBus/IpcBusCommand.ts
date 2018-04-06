import { IpcBusPeer } from './IpcBusInterfaces';

/** @internal */
export class IpcBusData {
    replyChannel?: string;
    resolve?: boolean;
    reject?: boolean;
    unsubscribeAll?: boolean;
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
        Connect                 = 'COO', // 'IpcBusCommand:connect';
        Disconnect              = 'COD', // 'IpcBusCommand:disconnect';
        Close                   = 'COC', // 'IpcBusCommand:close';
        SubscribeChannel        = 'CHS', // 'IpcBusCommand:subscribeChannel';
        UnsubscribeChannel      = 'CHU', // 'IpcBusCommand:unsubscribeChannel';
        UnsubscribeAllChannels  = 'CHA', // 'IpcBusCommand:unsubscribeAll';
        SendMessage             = 'MES', // 'IpcBusCommand:sendMessage';
        RequestMessage          = 'RQM', // 'IpcBusCommand:requestMessage';
        RequestResponse         = 'RQR', // 'IpcBusCommand:requestResponse';
        RequestCancel           = 'RQC'  // 'IpcBusCommand:requestCancel';
    };

    // export const IPC_BUS_COMMAND_CONNECT = 'IpcBusCommand:connect';
    // export const IPC_BUS_COMMAND_DISCONNECT = 'IpcBusCommand:disconnect';
    // export const IPC_BUS_COMMAND_CLOSE = 'IpcBusCommand:close';
    // export const IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL = 'IpcBusCommand:subscribeChannel';
    // export const IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL = 'IpcBusCommand:unsubscribeChannel';
    // export const IPC_BUS_COMMAND_UNSUBSCRIBE_ALL = 'IpcBusCommand:unsubscribeAll';
    // export const IPC_BUS_COMMAND_SENDMESSAGE = 'IpcBusCommand:sendMessage';
    // export const IPC_BUS_COMMAND_REQUESTMESSAGE = 'IpcBusCommand:requestMessage';
    // export const IPC_BUS_COMMAND_REQUESTRESPONSE = 'IpcBusCommand:requestResponse';
    // export const IPC_BUS_COMMAND_REQUESTCANCEL = 'IpcBusCommand:requestCancel';
}
