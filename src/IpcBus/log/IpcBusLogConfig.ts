export namespace IpcBusLogConfig {
    export enum Level {
        None = 0,
        Sent = 1,
        Get = 2,
        SentArgs = 4,
        GetArgs = 8,
        Max = Sent + Get + SentArgs + GetArgs
    }
}

/** @internal */
export interface IpcBusLogConfig {
    level: IpcBusLogConfig.Level;
    baseTime: number;
    now: number;
    hrnow: number;
    argMaxContentLen: number;
}
