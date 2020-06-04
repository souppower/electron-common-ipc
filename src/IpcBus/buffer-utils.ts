// const typedarray2buffer = require('typedarray-to-buffer');
const isTypedArray = require('is-typedarray').strict;
import * as zlib from 'zlib';

function fromArrayBuffer(array: ArrayBuffer | SharedArrayBuffer, byteOffset: number, length: number): Buffer {
    if (byteOffset < 0 || array.byteLength < byteOffset) {
        throw new RangeError('"offset" is outside of buffer bounds')
    }

    if (array.byteLength < byteOffset + (length || 0)) {
        throw new RangeError('"length" is outside of buffer bounds')
    }

    var buf
    if (byteOffset === undefined && length === undefined) {
        buf = new Uint8Array(array)
    } else if (length === undefined) {
        buf = new Uint8Array(array, byteOffset)
    } else {
        buf = new Uint8Array(array, byteOffset, length)
    }

    // Return an augmented `Uint8Array` instance
    Object.setPrototypeOf(buf, Buffer.prototype)

    return buf as Buffer;
}

export function CreateBuffer(value: any, encodingOrOffset?: string | number, length?: number): Buffer {
    if (isTypedArray(value)) {
        // To avoid a copy, use the typed array's underlying ArrayBuffer to back new Buffer
        var buf = fromArrayBuffer(value.buffer, encodingOrOffset as number, length as number)
        if (value.byteLength !== value.buffer.byteLength) {
            // Respect the "view", i.e. byteOffset and byteLength, without doing a copy
            buf = buf.slice(value.byteOffset, value.byteOffset + value.byteLength)
        }
        return buf
    }
    else {
        // Pass through all other types to `Buffer.from`
        return Buffer.from(value)
    }
}

export function CompressBuffer(buff: Buffer): Buffer {
    return zlib.gzipSync(buff, {
        chunkSize: 65536
    });
}

export function DecompressBuffer(buff: Buffer): Buffer {
    return zlib.gunzipSync(buff, {
        chunkSize: 65536
    });
}

