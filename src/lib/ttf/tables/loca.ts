// See documentation here: http://www.microsoft.com/typography/otspec/loca.htm

import MicroBuffer from "../../microbuffer";
import type { Font } from "../../sfnt.js";

function tableSize(font: Font, isShortFormat: boolean): number {
    const result = (font.glyphs.length + 1) * (isShortFormat ? 2 : 4); // by glyph count + tail

    return result;
}

function createLocaTable(font: Font): MicroBuffer {
    const isShortFormat = font.ttf_glyph_size < 0x20000;

    const buf = new MicroBuffer(tableSize(font, isShortFormat));

    let location = 0;

    // Array of offsets in GLYF table for each glyph
    for (const glyph of font.glyphs) {
        if (isShortFormat) {
            buf.writeUint16(location);
            location += glyph.ttf_size / 2; // actual location must be divided to 2 in short format
        } else {
            buf.writeUint32(location);
            location += glyph.ttf_size; //actual location is stored as is in long format
        }
    }

    // The last glyph location is stored to get last glyph length
    if (isShortFormat) {
        buf.writeUint16(location);
    } else {
        buf.writeUint32(location);
    }

    return buf;
}

export default createLocaTable;
