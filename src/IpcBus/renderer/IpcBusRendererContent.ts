import { IpcPacketBuffer } from 'socket-serializer';

/** @internal */
export namespace IpcBusRendererContent {
    export function FixRawContent(rawContent: IpcPacketBuffer.RawContent) {
        // Have an issue with Electron 8.x.x, Buffer sends through IPC is no more a Buffer at the destination but an Uint8Array !!
        // https://github.com/electron/electron/pull/20214
        if (rawContent.buffer instanceof Uint8Array) {
            // See https://github.com/feross/typedarray-to-buffer/blob/master/index.js
            // To avoid a copy, use the typed array's underlying ArrayBuffer to back new Buffer
            const arr = rawContent.buffer;
            rawContent.buffer = Buffer.from(arr.buffer);
            if (arr.byteLength !== arr.buffer.byteLength) {
                // Respect the "view", i.e. byteOffset and byteLength, without doing a copy
                rawContent.buffer = rawContent.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength);
            }
        }
    }
}

