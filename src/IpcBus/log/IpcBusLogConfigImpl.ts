import { IpcBusLogConfig } from './IpcBusLogConfig';

const LogLevelEnv = 'ELECTRON_IPC_LOG_LEVEL';
const LogBaseTimeEnv = 'ELECTRON_IPC_LOG_BASE_TIME';

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

    constructor() {
        const levelFromEnv = this.getLevelFromEnv();
        this._level = Math.max(IpcBusLogConfig.Level.None, levelFromEnv);
        const baseTimeFromEnv = this.getBaseTimeFromEnv();
        this._baseTime = Math.max(this.hrnow, baseTimeFromEnv);
    }

    protected getLevelFromEnv(): number {
        // In renderer process, there is no process object
        if (process && process.env) {
            const levelAny = process.env[LogLevelEnv];
            if (levelAny != null) {
                let level = Number(levelAny);
                level = Math.min(level, IpcBusLogConfig.Level.Args);
                level = Math.max(level, IpcBusLogConfig.Level.None);
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
}
