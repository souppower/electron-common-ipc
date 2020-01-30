import * as path from 'path';
import * as fs from 'fs';

const csvWriter = require('csv-write-stream');

import { JSON_stringify } from './IpcBusLogUtils';
import { IpcBusLog } from './IpcBusLog';
import { IpcBusLogConfig } from './IpcBusLogConfig';

/** @internal */
export class CSVLogger {
    private _logger: any;

    constructor(logPath: string) {
        !fs.existsSync(logPath) && fs.mkdirSync(logPath);

        this._logger = csvWriter({ separator: '\t', headers: [
            '#',
            'channel',
            'id',
            'kind',
            'peer id',
            'delay',
            'local',
            'peer',
            'arg0',
            'arg1',
            'arg2',
            'arg3',
            'arg4',
            'arg5'
        ]});
        this._logger.pipe(fs.createWriteStream(path.join(logPath, 'electron-common-ipcbus-bridge.csv.txt')));
    }

    // writeLine(cols: string[]) {
    //     for (let i = 0, l = cols.length; i < l; ++i) {
    //         const col = cols[i].replace(/\n|\r\n|\r|\t/g, '_');
    //         console.log(col);
    //         this._logger.write(col);
    //         this._logger.write('\t');
    //     }
    //     this._logger.write('\n');
    // }

    addLog(trace: IpcBusLog.Trace): void {
        const peer = trace.peer;
        const cols: string[] = [
            trace.order.toString(),
            trace.channel,
            trace.id,
            IpcBusLog.KindToStr(trace.kind),

            peer.id,
        ];

        switch (trace.kind) {
            case IpcBusLog.Kind.SEND_MESSAGE:
            case IpcBusLog.Kind.SEND_REQUEST: {
                cols.push('');
                cols.push('');
                break;
            }
            case IpcBusLog.Kind.SEND_REQUEST_RESPONSE: {
                const delay = trace.timestamp - trace.timestamp_source;
                cols.push(delay.toString());
                cols.push(trace.local ? 'local' : '');
                break;
            }
            case IpcBusLog.Kind.GET_MESSAGE:
            case IpcBusLog.Kind.GET_REQUEST:
            case IpcBusLog.Kind.GET_REQUEST_RESPONSE:
                const delay = trace.timestamp - trace.timestamp_source;
                cols.push(delay.toString());
                cols.push(trace.local ? 'local' : '');
                break;
        }
        cols.push(JSON.stringify(peer));

        let remainingArgs = 6;
        if (trace.args && trace.args.length) {
            remainingArgs -= trace.args.length;
            for (let i = 0, l = trace.args.length; i < l; ++i) {
                cols.push(JSON_stringify(trace.args[i], 255));
            }
        }
        for (let i = 0, l = remainingArgs; i < l; ++i) {
            cols.push('');
        }
        this._logger.write(cols);
        // this.writeLine(cols);
    }
}

let cvsLogger: CSVLogger;
IpcBusLog.SetLogLevelCVS = (level: IpcBusLogConfig.Level, filename: string): void => {
    if (level >= IpcBusLogConfig.Level.None) {
        if (cvsLogger == null) {
            cvsLogger = new CSVLogger(filename);
            const cb = cvsLogger.addLog.bind(cvsLogger);
            IpcBusLog.SetLogLevel(level, cb);
        }
    }
    else {
        cvsLogger = null;
    }
}
