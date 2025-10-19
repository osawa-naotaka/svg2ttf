// See documentation here: http://www.microsoft.com/typography/otspec/hmtx.htm

import MicroBuffer from "../../microbuffer";
import type { Font } from "../../sfnt.js";

function createHtmxTable(font: Font): MicroBuffer {
    const buf = new MicroBuffer(font.glyphs.length * 4);

    for (const glyph of font.glyphs) {
        buf.writeUint16(glyph.width); //advanceWidth
        buf.writeInt16(glyph.xMin); //lsb
    }
    return buf;
}

export default createHtmxTable;
