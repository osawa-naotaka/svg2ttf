// Taken from the punycode library
function ucs2encode(array: number[]): string {
    return array
        .map((value) => {
            let output = "";

            if (value > 0xffff) {
                value -= 0x10000;
                output += String.fromCharCode(((value >>> 10) & 0x3ff) | 0xd800);
                value = 0xdc00 | (value & 0x3ff);
            }
            output += String.fromCharCode(value);
            return output;
        })
        .join("");
}

function ucs2decode(string: string): number[] {
    const output: number[] = [];
    let counter = 0;
    const length = string.length;
    let value: number;
    let extra: number;

    while (counter < length) {
        value = string.charCodeAt(counter++);
        if (value >= 0xd800 && value <= 0xdbff && counter < length) {
            // high surrogate, and there is a next character
            extra = string.charCodeAt(counter++);
            if ((extra & 0xfc00) === 0xdc00) {
                // low surrogate
                output.push(((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000);
            } else {
                // unmatched surrogate; only append this code unit, in case the next
                // code unit is the high surrogate of a surrogate pair
                output.push(value);
                counter--;
            }
        } else {
            output.push(value);
        }
    }
    return output;
}

export default {
    encode: ucs2encode,
    decode: ucs2decode,
};
