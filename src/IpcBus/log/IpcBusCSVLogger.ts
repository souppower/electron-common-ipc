import * as path from 'path';
import * as fse from 'fs-extra';

// import CVS_stringify from 'csv-stringify';
const CVS_stringify = require('csv-stringify')

import { IpcBusLog } from './IpcBusLog';
import { IpcBusLogConfig } from './IpcBusLogConfig';
import { JSONLoggerBase, JSONLog } from './IpcBusJSONLogger';

/** @internal */
export class CSVLogger extends JSONLoggerBase {
    private _stringifyer: any; // CVS_stringify.Stringifier;

    constructor(logPath: string) {
        super();

        const filename = path.join(logPath, 'electron-common-ipcbus-bridge.csv');
        fse.ensureDirSync(logPath);
        try {
            fse.unlinkSync(filename);
        }
        catch (_) {}

        const options: any = {
            header: true,
            columns: [
                { key: 'order', header: '#' },
                { key: 'channel', header: 'channel' },
                { key: 'id', header: 'id' },
                { key: 'kind', header: 'kind' },
                { key: 'peer_id', header: 'peer id' },
                { key: 'delay', header: 'delay' },
                { key: 'local', header: 'local' },
                { key: 'peer', header: 'peer' },
                { key: 'peer_related', header: 'peer related' },
                { key: 'request', header: 'request' },
                { key: 'payload', header: 'payload' },
                { key: 'arg0', header: 'arg0' },
                { key: 'arg1', header: 'arg1' },
                { key: 'arg2', header: 'arg2' },
                { key: 'arg3', header: 'arg3' },
                { key: 'arg4', header: 'arg4' },
                { key: 'arg5', header: 'arg5' }
            ]
        };

        this._stringifyer = CVS_stringify(options);
        this._stringifyer.pipe(fse.createWriteStream(filename, { highWaterMark: 1024 }));
    }

    writeLog(jsonLog: JSONLog): void {
        const csvJsonLog = jsonLog as any;
        csvJsonLog.local = jsonLog.local ? 'local' : '';
        csvJsonLog.request = jsonLog.responseChannel ? `${jsonLog.responseChannel} => ${jsonLog.responseStatus}` : '';
        this._stringifyer.write(csvJsonLog);
    }
}

let cvsLogger: CSVLogger;
IpcBusLog.SetLogLevelCVS = (level: IpcBusLogConfig.Level, filename: string, argContentLen?: number): void => {
    if (level >= IpcBusLogConfig.Level.None) {
        if (cvsLogger == null) {
            cvsLogger = new CSVLogger(filename);
            const cb = cvsLogger.addLog.bind(cvsLogger);
            IpcBusLog.SetLogLevel(level, cb, argContentLen);
        }
    }
    else {
        cvsLogger = null;
    }
}
