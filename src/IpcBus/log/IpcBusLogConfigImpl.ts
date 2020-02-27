import { IpcBusLogConfig } from './IpcBusLogConfig';

const LogLevelEnv = 'ELECTRON_IPC_LOG_LEVEL';
const LogBaseTimeEnv = 'ELECTRON_IPC_LOG_BASE_TIME';
const ArgMaxContentLenEnv = 'ELECTRON_IPC_LOG_ARG_MAX_CONTENT_LEN';

let performanceNode: any;
try {
    performanceNode = require('perf_hooks').performance;
}
catch (err) {
}

// polyfil for window.performance.now
const performanceInterface: any = performanceNode || performance || {}
const performanceNow =
    performanceInterface.now        ||
    performanceInterface.mozNow     ||
    performanceInterface.msNow      ||
    performanceInterface.oNow       ||
    performanceInterface.webkitNow  ||
  function(){ return (new Date()).getTime() }

/** @internal */
export class IpcBusLogConfigImpl implements IpcBusLogConfig {
    protected _level: IpcBusLogConfig.Level;
    protected _baseTime: number;
    protected _argMaxContentLen: number;

    constructor() {
        const levelFromEnv = this.getLevelFromEnv();
        this._level = Math.max(IpcBusLogConfig.LevelMin, levelFromEnv);
        const baseTimeFromEnv = this.getBaseTimeFromEnv();
        this._baseTime = Math.max(this.now, baseTimeFromEnv);
        const argMaxLenFromEnv = this.getArgMaxContentLenFromEnv();
        this._argMaxContentLen = Math.max(-1, argMaxLenFromEnv);
    }

    protected getLevelFromEnv(): number {
        // In renderer process, there is no process object
        if (process && process.env) {
            const levelAny = process.env[LogLevelEnv];
            if (levelAny != null) {
                let level = Number(levelAny);
                level = Math.min(level, IpcBusLogConfig.LevelMax);
                level = Math.max(level, IpcBusLogConfig.LevelMin);
                return level;
            }
        }
        return -1;
    }

    protected getBaseTimeFromEnv(): number {
        // In renderer process, there is no process object
        if (process && process.env) {
            const baseTimeAny = process.env[LogBaseTimeEnv];
            if (baseTimeAny != null) {
                const baseline = Number(baseTimeAny);
                return baseline;
            }
        }
        return -1;
    }

    protected getArgMaxContentLenFromEnv(): number {
        // In renderer process, there is no process object
        if (process && process.env) {
            const argMaxContentLenAny = process.env[ArgMaxContentLenEnv];
            if (argMaxContentLenAny != null) {
                const argMaxContentLen = Number(argMaxContentLenAny);
                return argMaxContentLen;
            }
        }
        return -1;
    }

    get level(): IpcBusLogConfig.Level {
        return this._level;
    }

    set level(level: IpcBusLogConfig.Level) {
        if (process && process.env) {
            process.env[LogLevelEnv] = level.toString();
        }
        this._level = level;
    }

    get baseTime(): number {
        return this._baseTime;
    }

    get now(): number {
        return Date.now();
    }

    get hrnow(): number {
        const clocktime = performanceNow.call(performanceInterface) * 1e-3;
        return clocktime;
    }

    set baseTime(baseTime: number) {
        if (process && process.env) {
            process.env[LogBaseTimeEnv] = baseTime.toString();
        }
        this._baseTime = baseTime;
    }

    set argMaxContentLen(argMaxContentLen: number) {
        argMaxContentLen = (argMaxContentLen == null) ? -1 : argMaxContentLen;
        if (process && process.env) {
            process.env[ArgMaxContentLenEnv] = argMaxContentLen.toString();
        }
        this._argMaxContentLen = argMaxContentLen;
    }

    get argMaxContentLen(): number {
        return this._argMaxContentLen;
    }
}
