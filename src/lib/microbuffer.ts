export default class MicroBuffer {
    buffer: Uint8Array;
    start: number;
    length: number;
    offset: number;

    constructor(buffer: MicroBuffer | Uint8Array | number, start?: number, length?: number) {
        const isInherited = buffer instanceof MicroBuffer;

        this.buffer = isInherited ? buffer.buffer : typeof buffer === "number" ? new Uint8Array(buffer) : buffer;

        this.start = (start || 0) + (isInherited ? buffer.start : 0);
        this.length = length || this.buffer.length - this.start;
        this.offset = 0;
    }

    getUint8(pos: number): number {
        return this.buffer[pos + this.start];
    }

    getUint16(pos: number, littleEndian?: boolean): number {
        let val: number;
        if (littleEndian) {
            throw new Error("not implemented");
        } else {
            val = this.buffer[pos + 1 + this.start];
            val += (this.buffer[pos + this.start] << 8) >>> 0;
        }
        return val;
    }

    getUint32(pos: number, littleEndian?: boolean): number {
        let val: number;
        if (littleEndian) {
            throw new Error("not implemented");
        } else {
            val = this.buffer[pos + 1 + this.start] << 16;
            val |= this.buffer[pos + 2 + this.start] << 8;
            val |= this.buffer[pos + 3 + this.start];
            val += (this.buffer[pos + this.start] << 24) >>> 0;
        }
        return val;
    }

    setUint8(pos: number, value: number): void {
        this.buffer[pos + this.start] = value & 0xff;
    }

    setUint16(pos: number, value: number, littleEndian?: boolean): void {
        const offset = pos + this.start;
        const buf = this.buffer;
        if (littleEndian) {
            buf[offset] = value & 0xff;
            buf[offset + 1] = (value >>> 8) & 0xff;
        } else {
            buf[offset] = (value >>> 8) & 0xff;
            buf[offset + 1] = value & 0xff;
        }
    }

    setUint32(pos: number, value: number, littleEndian?: boolean): void {
        const offset = pos + this.start;
        const buf = this.buffer;
        if (littleEndian) {
            buf[offset] = value & 0xff;
            buf[offset + 1] = (value >>> 8) & 0xff;
            buf[offset + 2] = (value >>> 16) & 0xff;
            buf[offset + 3] = (value >>> 24) & 0xff;
        } else {
            buf[offset] = (value >>> 24) & 0xff;
            buf[offset + 1] = (value >>> 16) & 0xff;
            buf[offset + 2] = (value >>> 8) & 0xff;
            buf[offset + 3] = value & 0xff;
        }
    }

    writeUint8(value: number): void {
        this.buffer[this.offset + this.start] = value & 0xff;
        this.offset++;
    }

    writeInt8(value: number): void {
        this.setUint8(this.offset, value < 0 ? 0xff + value + 1 : value);
        this.offset++;
    }

    writeUint16(value: number, littleEndian?: boolean): void {
        this.setUint16(this.offset, value, littleEndian);
        this.offset += 2;
    }

    writeInt16(value: number, littleEndian?: boolean): void {
        this.setUint16(this.offset, value < 0 ? 0xffff + value + 1 : value, littleEndian);
        this.offset += 2;
    }

    writeUint32(value: number, littleEndian?: boolean): void {
        this.setUint32(this.offset, value, littleEndian);
        this.offset += 4;
    }

    writeInt32(value: number, littleEndian?: boolean): void {
        this.setUint32(this.offset, value < 0 ? 0xffffffff + value + 1 : value, littleEndian);
        this.offset += 4;
    }

    // get current position
    //
    tell(): number {
        return this.offset;
    }

    // set current position
    //
    seek(pos: number): void {
        this.offset = pos;
    }

    fill(value: number): void {
        let index = this.length - 1;
        while (index >= 0) {
            this.buffer[index + this.start] = value;
            index--;
        }
    }

    writeUint64(value: number): void {
        // we canot use bitwise operations for 64bit values because of JavaScript limitations,
        // instead we should divide it to 2 Int32 numbers
        // 2^32 = 4294967296
        const hi = Math.floor(value / 4294967296);
        const lo = value - hi * 4294967296;
        this.writeUint32(hi);
        this.writeUint32(lo);
    }

    writeBytes(data: Uint8Array): void {
        const buffer = this.buffer;
        const offset = this.offset + this.start;
        buffer.set(data, offset);
        this.offset += data.length;
    }

    toString(offset?: number, length?: number): string {
        // default values if not set
        offset = offset || 0;
        length = length || this.length - offset;

        // add buffer shift
        const start = offset + this.start;
        const end = start + length;

        let string = "";
        for (let i = start; i < end; i++) {
            string += String.fromCharCode(this.buffer[i]);
        }
        return string;
    }

    toArray(): Uint8Array {
        return this.buffer.subarray(this.start, this.start + this.length);
    }
}
