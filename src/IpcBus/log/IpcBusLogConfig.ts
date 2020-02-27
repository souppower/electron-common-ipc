export namespace IpcBusLogConfig {
    export enum Level {
        None = 0,
        Sent = 1,
        Get = 2,
        SentArgs = 4,
        GetArgs = 8,
    }

    export const LevelMax = IpcBusLogConfig.Level.Sent | IpcBusLogConfig.Level.Get | IpcBusLogConfig.Level.SentArgs | IpcBusLogConfig.Level.GetArgs;
    export const LevelMin = IpcBusLogConfig.Level.None;
}

/** @internal */
export interface IpcBusLogConfig {
    level: IpcBusLogConfig.Level;
    baseTime: number;
    now: number;
    hrnow: number;
    argMaxContentLen: number;
}
