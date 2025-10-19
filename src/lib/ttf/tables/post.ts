// See documentation here: http://www.microsoft.com/typography/otspec/post.htm

import MicroBuffer from "../../microbuffer";
import type { Font } from "../../sfnt.js";

function tableSize(font: Font, names: number[][]): number {
    let result = 36; // table header

    result += font.glyphs.length * 2; // name declarations
    for (const name of names) {
        result += name.length;
    }
    return result;
}

function pascalString(str: string): number[] {
    const bytes: number[] = [];
    const len = str ? (str.length < 256 ? str.length : 255) : 0; //length in Pascal string is limited with 255

    bytes.push(len);
    for (let i = 0; i < len; i++) {
        const char = str.charCodeAt(i);

        bytes.push(char < 128 ? char : 95); //non-ASCII characters are substituted with '_'
    }
    return bytes;
}

function createPostTable(font: Font): MicroBuffer {
    const names: number[][] = [];

    for (const glyph of font.glyphs) {
        if (glyph.unicode !== 0) {
            names.push(pascalString(glyph.name));
        }
    }

    const buf = new MicroBuffer(tableSize(font, names));

    buf.writeInt32(0x20000); // formatType,  version 2.0
    buf.writeInt32(font.italicAngle); // italicAngle
    buf.writeInt16(font.underlinePosition); // underlinePosition
    buf.writeInt16(font.underlineThickness); // underlineThickness
    buf.writeUint32(font.isFixedPitch); // isFixedPitch
    buf.writeUint32(0); // minMemType42
    buf.writeUint32(0); // maxMemType42
    buf.writeUint32(0); // minMemType1
    buf.writeUint32(0); // maxMemType1
    buf.writeUint16(font.glyphs.length); // numberOfGlyphs

    // Array of glyph name indexes
    let index = 258; // first index of custom glyph name, it is calculated as glyph name index + 258

    for (const glyph of font.glyphs) {
        if (glyph.unicode === 0) {
            buf.writeUint16(0); // missed element should have .notDef name in the Macintosh standard order.
        } else {
            buf.writeUint16(index++);
        }
    }

    // Array of glyph name indexes
    for (const name of names) {
        buf.writeBytes(name);
    }

    return buf;
}

export default createPostTable;
