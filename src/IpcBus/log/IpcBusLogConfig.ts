export namespace IpcBusLogConfig {
    export enum Level {
        None = 0,
        Sent = 1,
        Received = 2,
        Args = 4
    }
}

/** @internal */
export interface IpcBusLogConfig {
    level: IpcBusLogConfig.Level;
    baseTime: number;
    now: number;
    hrnow: number;
}
