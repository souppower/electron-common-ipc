import * as util from 'util';

import type { IpcPacketBufferCore } from 'socket-serializer';
// import * as zlib from 'zlib';

// const threshold = 4000000;

/** @internal */
export interface IpcBusRendererContent extends IpcPacketBufferCore.RawData {
    // compressed: boolean;
}

// export interface IpcBusContent extends IpcBusRendererContent {
//     bufferCompressed?: Buffer;
// }

/** @internal */
export namespace IpcBusRendererContent {
    export function Uint8ArrayToBuffer(rawBuffer: Buffer | Uint8Array): Buffer {
        if (util.types.isUint8Array(rawBuffer)) {
            // See https://github.com/feross/typedarray-to-buffer/blob/master/index.js
            // To avoid a copy, use the typed array's underlying ArrayBuffer to back new Buffer
            const arr = rawBuffer;
            rawBuffer = Buffer.from(arr.buffer);
            if (arr.byteLength !== arr.buffer.byteLength) {
                // Respect the "view", i.e. byteOffset and byteLength, without doing a copy
                rawBuffer = rawBuffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength);
            }
        }
        return rawBuffer as Buffer;
    }

    export function FixRawContent(rawContent: IpcBusRendererContent, forceSingleBuffer?: boolean) {
        if (rawContent.buffer) {
            rawContent.buffer = Uint8ArrayToBuffer(rawContent.buffer);
        }
        else if (Array.isArray(rawContent.buffers)) {
            for (let i = 0, l = rawContent.buffers.length; i < l; ++i) {
                rawContent.buffers[i] = Uint8ArrayToBuffer(rawContent.buffers[i]);
            }
            if (forceSingleBuffer) {
                rawContent.buffer = Buffer.concat(rawContent.buffers);
                rawContent.buffers = undefined;
            }
        }
    }

    // export function PackRawContent(buffRawContent: IpcPacketBuffer.RawData): IpcBusRendererContent {
    //     const rawContent = buffRawContent as IpcBusRendererContent;
    //     // if ((rawContent.buffer.length > threshold) && !rawContent.compressed) {
    //     //     rawContent.compressed = true;
    //     //     rawContent.buffer = CompressBuffer(rawContent.buffer);
    //     // }
    //     return rawContent;
    // }

    // export function UnpackRawContent(rawContent: IpcBusRendererContent) {
    //     // if (rawContent.compressed) {
    //     //     rawContent.compressed = false;
    //     //     rawContent.buffer = DecompressBuffer(rawContent.buffer);
    //     // }
    //     return rawContent;
    // }
}

// CompressBuffer;
// function CompressBuffer(buff: Buffer): Buffer {
//     return zlib.gzipSync(buff, {
//         chunkSize: 65536
//     });
// }

// DecompressBuffer;
// function DecompressBuffer(buff: Buffer): Buffer {
//     return zlib.gunzipSync(buff, {
//         chunkSize: 65536
//     });
// }

