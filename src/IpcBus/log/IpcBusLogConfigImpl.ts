import { IpcBusLogConfig } from './IpcBusLogConfig';

const LogLevelEnv = 'ELECTRON_IPC_LOG_LEVEL';
const LogBaseTimeEnv = 'ELECTRON_IPC_LOG_BASE_TIME';

/** @internal */
export class IpcBusLogConfigImpl implements IpcBusLogConfig {
    private _level: IpcBusLogConfig.Level;
    private _baseTime: number;

    constructor() {
        const levelFromEnv = this.getLevelFromEnv();
        this._level = Math.max(IpcBusLogConfig.Level.None, levelFromEnv);
        const baseTimeFromEnv = this.getBaseTimeFromEnv();
        this._baseTime = Math.max(Date.now(), baseTimeFromEnv);
    }

    protected getLevelFromEnv(): number {
        // In renderer process, there is no process object
        if (process && process.env) {
            const levelAny = process.env[LogLevelEnv];
            let level = Number(levelAny);
            level = Math.min(level, IpcBusLogConfig.Level.Args);
            level = Math.max(level, IpcBusLogConfig.Level.None);
            return level;
        }
        return -1;
    }

    protected getBaseTimeFromEnv(): number {
        // In renderer process, there is no process object
        if (process && process.env) {
            const baseTimeAny = process.env[LogBaseTimeEnv];
            let baseTime = Number(baseTimeAny);
            return baseTime;
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

    set baseTime(baseTime: number) {
        if (process && process.env) {
            process.env[LogBaseTimeEnv] = baseTime.toString();
        }
        this._baseTime = baseTime;
    }
}

export const ipcBusLogConfig = new IpcBusLogConfigImpl();