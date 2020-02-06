import * as path from 'path';
import * as fse from 'fs-extra';

const csvWriter = require('csv-write-stream');

import { JSON_stringify } from './IpcBusLogUtils';
import { IpcBusLog } from './IpcBusLog';
import { IpcBusLogConfig } from './IpcBusLogConfig';

/** @internal */
export class CSVLogger {
    private _logger: any;

    constructor(logPath: string) {
        const filename = path.join(logPath, 'electron-common-ipcbus-bridge.csv.txt');
        fse.ensureDir(logPath);
        fse.unlink(filename);

        this._logger = csvWriter({ separator: '\t', headers: [
            '#',
            'channel',
            'id',
            'kind',
            'peer id',
            'delay',
            'local',
            'peer',
            'related peer',
            'request',
            'payload',
            'arg0',
            'arg1',
            'arg2',
            'arg3',
            'arg4',
            'arg5'
        ]});
        this._logger.pipe(fse.createWriteStream(filename));
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
        const cols: string[] = [
            trace.order.toString(),
            trace.first.channel,
            trace.id,
            IpcBusLog.KindToStr(trace.current.kind),
            trace.first.peer.id,
        ];

        switch (trace.current.kind) {
            case IpcBusLog.Kind.SEND_MESSAGE:
            case IpcBusLog.Kind.SEND_REQUEST: {
                cols.push('');
                break;
            }
            case IpcBusLog.Kind.SEND_CLOSE_REQUEST: {
                // const delay = trace.timestamp - trace.timestamp_source;
                // cols.push(delay.toString());
                cols.push('');
                break;
            }
            case IpcBusLog.Kind.SEND_REQUEST_RESPONSE: {
                const delay = trace.current.timestamp - trace.first.timestamp;
                cols.push(delay.toString());
                break;
            }
            case IpcBusLog.Kind.GET_CLOSE_REQUEST:
            case IpcBusLog.Kind.GET_MESSAGE:
            case IpcBusLog.Kind.GET_REQUEST:
            case IpcBusLog.Kind.GET_REQUEST_RESPONSE:
                const delay = trace.current.timestamp - trace.first.timestamp;
                cols.push(delay.toString());
                break;
        }
        cols.push(trace.current.local ? 'local' : '');
        cols.push(JSON.stringify(trace.current.peer));
        if (trace.current.related_peer.id != trace.current.peer.id) {
            cols.push(JSON.stringify(trace.current.related_peer));
        }
        else {
            cols.push('');
        }
        cols.push(trace.current.responseChannel ? `${trace.current.responseChannel} => ${trace.current.responseStatus}` : '');
        cols.push(trace.current.payload ? trace.current.payload.toString() : '');

        let remainingArgs = 6;
        const args = trace.current.args;
        if (args && args.length) {
            remainingArgs -= args.length;
            for (let i = 0, l = args.length; i < l; ++i) {
                cols.push(JSON_stringify(args[i], 255));
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
