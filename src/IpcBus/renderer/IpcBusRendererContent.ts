import { IpcPacketBuffer } from 'socket-serializer';
import * as zlib from 'zlib';

const threshold = 4000000;

/** @internal */
export interface IpcBusRendererContent extends IpcPacketBuffer.RawContent {
    compressed: boolean;
}

// export interface IpcBusContent extends IpcBusRendererContent {
//     bufferCompressed?: Buffer;
// }

/** @internal */
export namespace IpcBusRendererContent {
    export function FixRawContent(rawContent: IpcBusRendererContent) {
        // Have an issue with Electron 8.x.x, Buffer sends through IPC is no more a Buffer at the destination but an Uint8Array !!
        // https://github.com/electron/electron/pull/20214
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

    export function PackRawContent(buffRawContent: IpcPacketBuffer.RawContent): IpcBusRendererContent {
        const rawContent = buffRawContent as IpcBusRendererContent;
        if ((rawContent.buffer.length > threshold) && !rawContent.compressed) {
            rawContent.compressed = true;
            rawContent.buffer = CompressBuffer(rawContent.buffer);
        }
        return rawContent;
    }

    export function UnpackRawContent(rawContent: IpcBusRendererContent) {
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

