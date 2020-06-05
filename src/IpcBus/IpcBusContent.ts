import { IpcPacketBuffer } from 'socket-serializer';
import * as zlib from 'zlib';

const threshold = 4000000;

/** @internal */
export interface IpcBusRawContent extends IpcPacketBuffer.RawContent {
    compressed: boolean;
}

// export interface IpcBusContent extends IpcBusRawContent {
//     bufferCompressed?: Buffer;
// }

/** @internal */
export namespace IpcBusRawContent {
    export function FixRawContent(rawContent: IpcBusRawContent) {
        // Seems to have an issue with Electron 8.x.x, Buffer received through IPC is no more a Buffer but an Uint8Array !!
        if (rawContent.buffer instanceof Uint8Array) {
            // See https://github.com/feross/typedarray-to-buffer/blob/master/index.js
            // To avoid a copy, use the typed array's underlying ArrayBuffer to back new Buffer
            const arr = rawContent.buffer;
            rawContent.buffer = Buffer.from(arr.buffer);
            if (arr.byteLength !== arr.buffer.byteLength) {
                // Respect the "view", i.e. byteOffset and byteLength, without doing a copy
                rawContent.buffer = rawContent.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength)
              }
        }
    }

    export function PackRawContent(rawContent: IpcPacketBuffer.RawContent): IpcBusRawContent {
        const ipcBusContent = rawContent as IpcBusRawContent;
        if (ipcBusContent.buffer.length > threshold) {
            ipcBusContent.compressed = true;
            ipcBusContent.buffer = CompressBuffer(ipcBusContent.buffer);
        }
        return ipcBusContent;
    }

    export function UnpackRawContent(rawContent: IpcBusRawContent) {
        if (rawContent.compressed) {
            rawContent.compressed = false;
            rawContent.buffer = DecompressBuffer(rawContent.buffer);
        }
        return rawContent;
    }
}

function CompressBuffer(buff: Buffer): Buffer {
    return zlib.gzipSync(buff, {
        chunkSize: 65536
    });
}

function DecompressBuffer(buff: Buffer): Buffer {
    return zlib.gunzipSync(buff, {
        chunkSize: 65536
    });
}

