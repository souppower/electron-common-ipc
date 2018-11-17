import { JSONParser } from 'json-helpers';

export interface CrossFrameMessage {
    uuid: string;
    channel: string;
    args?: any[];
}

export interface CrossFrameWrap {
    [CrossFrameMessage.CrossFrameKeyId]: CrossFrameMessage;
}

export namespace CrossFrameMessage {
    export const CrossFrameKeyId = '__cross-frame-message__';

    export function Decode(data: any): CrossFrameMessage {
        // We don't control all message events, they won't always be JSON
        try {
            let wrap: CrossFrameWrap = JSONParser.parse(data);
            let packet = wrap[CrossFrameKeyId];
            if (packet) {
                return packet;
            }
        }
        catch (e) {
        }
        return null;
    }

    // Takes a channel and the arguments to emit with and serialises it
    // for transmission
    export function Encode(uuid: string, channel: string, args: any[]): any {
        let wrap: CrossFrameWrap = {
            [CrossFrameKeyId]: {
                uuid,
                channel,
                args: args
            }
        };
        return JSONParser.stringify(wrap);
    }
}
