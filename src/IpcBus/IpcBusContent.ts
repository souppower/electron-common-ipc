import { IpcPacketBuffer } from 'socket-serializer';
import * as zlib from 'zlib';

const threshold = 4000000;

/** @internal */
export interface IpcBusContent extends IpcPacketBuffer.RawContent {
    compressed: boolean;
    bufferCompressed?: Buffer;
}

/** @internal */
export namespace IpcBusContent {
    export function UnpackRawContent(ipcBusContent: IpcBusContent): IpcPacketBuffer.RawContent {
        Unpack(ipcBusContent);
        return ipcBusContent as IpcPacketBuffer.RawContent;
    }

    export function Unpack(ipcBusContent: IpcBusContent) {
        // Seems to have an issue with Electron 8.x.x, Buffer received through IPC is no more a Buffer but an Uint8Array !!
        if (ipcBusContent.buffer instanceof Uint8Array) {
            // // To avoid a copy, use the typed array's underlying ArrayBuffer to back new Buffer
            ipcBusContent.buffer = Buffer.from(ipcBusContent.buffer.buffer);
        }
        if (ipcBusContent.compressed && (ipcBusContent.bufferCompressed == null)) {
            ipcBusContent.bufferCompressed = ipcBusContent.buffer;
            ipcBusContent.buffer = DecompressBuffer(ipcBusContent.buffer);
        }
    }

    export function PackRawContent(rawContent: IpcPacketBuffer.RawContent): IpcBusContent {
        const ipcBusContent = rawContent as IpcBusContent;
        if (ipcBusContent.buffer.length > threshold) {
            ipcBusContent.compressed = true;
            ipcBusContent.buffer = CompressBuffer(ipcBusContent.buffer);
        }
        else {
            ipcBusContent.compressed = false;
        }
        return ipcBusContent;
    }

    export function Pack(ipcBusContent: IpcBusContent): IpcBusContent {
        if ((ipcBusContent.buffer.length > threshold) && !ipcBusContent.compressed) {
            ipcBusContent.compressed = true;
            ipcBusContent.bufferCompressed = CompressBuffer(ipcBusContent.buffer);
        }
        const packContent: IpcBusContent = {
            type: ipcBusContent.type,
            contentSize: ipcBusContent.contentSize,
            compressed: ipcBusContent.compressed,
            buffer: ipcBusContent.bufferCompressed || ipcBusContent.buffer
        }
        return packContent;
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

