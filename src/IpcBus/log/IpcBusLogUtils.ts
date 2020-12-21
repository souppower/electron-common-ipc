const CutMarker = '\'__cut__\'';

export function JSON_stringify_array(data: any[], maxLen: number, output: string): string {
    output += '[';
    for (let i = 0, l = data.length; i < l; ++i) {
        if (output.length >= maxLen) {
            output += CutMarker;
            break;
        }
        output += JSON_stringify(data[i], maxLen - output.length);
        output += ',';
    }
    output += ']';
    return output;
}

export function JSON_stringify_object(data: any, maxLen: number, output: string): string {
    output += '{';
    if (data) {
        const keys = Object.keys(data);
        for (let i = 0, l = keys.length; i < l; ++i) {
            if (output.length >= maxLen) {
                output += CutMarker;
                break;
            }
            const key = keys[i];
            output += key + ': ';
            if (output.length >= maxLen) {
                output += CutMarker;
                break;
            }
            output += JSON_stringify(data[key], maxLen - output.length);
            output += ',';
        }
    }
    else {
        output += 'null';
    }
    output += '}';
    return output;
}

export function JSON_stringify_string(data: string, maxLen: number): string {
    // output = data.substr(0, maxLen).replace(/(\r\n|\n|\r|\t)/gm, ' ');
    if (data.length > maxLen) {
        return data.substr(0, maxLen) + CutMarker;
    }
    else {
        return data;
    }
}

export function JSON_stringify(data: any, maxLen: number): string {
    let output = '';
    switch (typeof data) {
        case 'object':
            if (Buffer.isBuffer(data)) {
                if (data.length > maxLen * 2) {
                    output = data.toString('utf8', 0, maxLen) + CutMarker;
                }
                else {
                    output = data.toString('utf8', 0, maxLen);
                }
            }
            else if (Array.isArray(data)) {
                output = JSON_stringify_array(data, maxLen, output);
            }
            else if (data instanceof Date) {
                output = data.toISOString();
            }
            else {
                output = JSON_stringify_object(data, maxLen, output);
            }
            break;
        case 'string':
            output = JSON_stringify_string(data, maxLen);
            break;
        case 'number':
            output = data.toString();
            break;
        case 'boolean':
            output = data ? 'true' : 'false';
            break;
        case 'undefined':
            output = '__undefined__'
            break;
    }
    return output;
}

export function CutData(data: any, maxLen: number): any {
    switch (typeof data) {
        case 'object':
            if (Buffer.isBuffer(data)) {
                if (data.length > maxLen * 2) {
                    data = data.toString('utf8', 0, maxLen) + CutMarker;
                }
                else {
                    data = data.toString('utf8', 0, maxLen);
                }
            }
            else if (Array.isArray(data)) {
                data = JSON_stringify_array(data, maxLen, '');
            }
            else if (data instanceof Date) {
                return data;
            }
            else {
                return JSON_stringify_object(data, maxLen, '');
            }
            break;
        case 'string':
            data = JSON_stringify_string(data, maxLen);
            break;
        case 'number':
            return data;
        case 'boolean':
            return data;
        case 'undefined':
            return data;
    }
    return data;
}
