import { IpcPacketBuffer } from 'socket-serializer';

import { CreateBuffer, DecompressBuffer, CompressBuffer } from './buffer-utils';

/** @internal */
export interface IpcBusContent extends IpcPacketBuffer.RawContent {
    compressed: boolean;
    bufferCompressed?: Buffer;
}

/** @internal */
export namespace IpcBusContent {
    export function UnpackRawContent(ipcBusContent: IpcBusContent): IpcPacketBuffer.RawContent {
        Unpack(ipcBusContent);
        const rawContent: IpcPacketBuffer.RawContent = {
            type: ipcBusContent.type,
            contentSize: ipcBusContent.contentSize,
            buffer: ipcBusContent.buffer
        };
        return rawContent;
    }

    export function Unpack(ipcBusContent: IpcBusContent) {
        // Seems to have an issue with Electron 9.x.x, Buffer received through IPC is no more a buffer but a pure TypedArray !!
        if (Buffer.isBuffer(ipcBusContent.buffer) === false) {
            ipcBusContent.buffer = CreateBuffer(ipcBusContent.buffer);
        }
        if (ipcBusContent.compressed) {
            ipcBusContent.buffer = DecompressBuffer(ipcBusContent.buffer);
        }
        else {
            ipcBusContent.bufferCompressed = ipcBusContent.buffer;
        }
    }

    export function PackRawContent(rawContent: IpcPacketBuffer.RawContent): IpcBusContent {
        let compressed = false;
        let buffer = rawContent.buffer;
        if (rawContent.buffer.length > 1000000) {
            compressed = true;
            buffer = CompressBuffer(rawContent.buffer);
        }
        const packContent: IpcBusContent = {
            type: rawContent.type,
            contentSize: rawContent.contentSize,
            compressed,
            buffer
        };
        return packContent;
    }

    export function Pack(ipcBusContent: IpcBusContent): IpcBusContent {
        if ((ipcBusContent.buffer.length > 1000000) && !ipcBusContent.compressed) {
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

