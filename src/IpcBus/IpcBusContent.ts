import { IpcPacketBuffer } from 'socket-serializer';

import { CreateBuffer, DecompressBuffer, CompressBuffer } from './buffer-utils';

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
        // Seems to have an issue with Electron 9.x.x, Buffer received through IPC is no more a buffer but a pure TypedArray !!
        if (Buffer.isBuffer(ipcBusContent.buffer) === false) {
            ipcBusContent.buffer = CreateBuffer(ipcBusContent.buffer);
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

