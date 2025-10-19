export default class Str {
    str: string;

    constructor(str: string) {
        this.str = str;
    }

    toUTF8Bytes(): number[] {
        const byteArray: number[] = [];

        for (let i = 0; i < this.str.length; i++) {
            if (this.str.charCodeAt(i) <= 0x7f) {
                byteArray.push(this.str.charCodeAt(i));
            } else {
                const h = encodeURIComponent(this.str.charAt(i)).substr(1).split("%");

                for (let j = 0; j < h.length; j++) {
                    byteArray.push(parseInt(h[j], 16));
                }
            }
        }
        return byteArray;
    }

    toUCS2Bytes(): number[] {
        // Code is taken here:
        // http://stackoverflow.com/questions/6226189/how-to-convert-a-string-to-bytearray
        const byteArray: number[] = [];
        let ch: number;

        for (let i = 0; i < this.str.length; ++i) {
            ch = this.str.charCodeAt(i); // get char
            byteArray.push(ch >> 8);
            byteArray.push(ch & 0xff);
        }
        return byteArray;
    }
}
