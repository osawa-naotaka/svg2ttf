import MicroBuffer from "./microbuffer";
import type { Font } from "./sfnt.js";
import createCMapTable from "./ttf/tables/cmap.js";
import createGlyfTable from "./ttf/tables/glyf.js";
import createGSUBTable from "./ttf/tables/gsub.js";
import createHeadTable from "./ttf/tables/head.js";
import createHHeadTable from "./ttf/tables/hhea.js";
import createHtmxTable from "./ttf/tables/hmtx.js";
import createLocaTable from "./ttf/tables/loca.js";
import createMaxpTable from "./ttf/tables/maxp.js";
import createNameTable from "./ttf/tables/name.js";
import createOS2Table from "./ttf/tables/os2.js";
import createPostTable from "./ttf/tables/post.js";
import * as utils from "./ttf/utils.js";

interface TableDefinition {
    innerName: string;
    order: number;
    create: (font: Font) => MicroBuffer;
}

interface TableWithMetadata extends TableDefinition {
    buffer: MicroBuffer;
    length: number;
    corLength: number;
    checkSum: number;
    offset: number;
}

// Tables
const TABLES: TableDefinition[] = [
    { innerName: "GSUB", order: 4, create: createGSUBTable }, // GSUB
    { innerName: "OS/2", order: 4, create: createOS2Table }, // OS/2
    { innerName: "cmap", order: 6, create: createCMapTable }, // cmap
    { innerName: "glyf", order: 8, create: createGlyfTable }, // glyf
    { innerName: "head", order: 2, create: createHeadTable }, // head
    { innerName: "hhea", order: 1, create: createHHeadTable }, // hhea
    { innerName: "hmtx", order: 5, create: createHtmxTable }, // hmtx
    { innerName: "loca", order: 7, create: createLocaTable }, // loca
    { innerName: "maxp", order: 3, create: createMaxpTable }, // maxp
    { innerName: "name", order: 9, create: createNameTable }, // name
    { innerName: "post", order: 10, create: createPostTable }, // post
];

// Various constants
const CONST = {
    VERSION: 0x10000,
    CHECKSUM_ADJUSTMENT: 0xb1b0afba,
};

function ulong(t: number): number {
    t &= 0xffffffff;
    if (t < 0) {
        t += 0x100000000;
    }
    return t;
}

function calc_checksum(buf: MicroBuffer): number {
    let sum = 0;
    const nlongs = Math.floor(buf.length / 4);

    for (let i = 0; i < nlongs; ++i) {
        const t = buf.getUint32(i * 4);

        sum = ulong(sum + t);
    }

    const leftBytes = buf.length - nlongs * 4; //extra 1..3 bytes found, because table is not aligned. Need to include them in checksum too.

    if (leftBytes > 0) {
        let leftRes = 0;

        for (let i = 0; i < 4; i++) {
            leftRes = (leftRes << 8) + (i < leftBytes ? buf.getUint8(nlongs * 4 + i) : 0);
        }
        sum = ulong(sum + leftRes);
    }
    return sum;
}

function generateTTF(font: Font): MicroBuffer {
    // Prepare TTF contours objects. Note, that while sfnt countours are classes,
    // ttf contours are just plain arrays of points
    for (const glyph of font.glyphs) {
        glyph.ttfContours = glyph.contours.map((contour) => contour.points);
    }

    // Process ttf contours data
    for (const glyph of font.glyphs) {
        // 0.3px accuracy is ok. fo 1000x1000.
        glyph.ttfContours = utils.simplify(glyph.ttfContours ?? [], 0.3);
        glyph.ttfContours = utils.simplify(glyph.ttfContours, 0.3); // one pass is not enougth

        // Interpolated points can be removed. 1.1px is acceptable
        // measure - it will give us 1px error after coordinates rounding.
        glyph.ttfContours = utils.interpolate(glyph.ttfContours, 1.1);

        glyph.ttfContours = utils.roundPoints(glyph.ttfContours);
        glyph.ttfContours = utils.removeClosingReturnPoints(glyph.ttfContours);
        glyph.ttfContours = utils.toRelative(glyph.ttfContours);
    }

    // Add tables
    const headerSize = 12 + 16 * TABLES.length; // TTF header plus table headers
    let bufSize = headerSize;

    const tablesWithMetadata: TableWithMetadata[] = TABLES.map((table) => {
        //store each table in its own buffer
        const buffer = table.create(font);
        const length = buffer.length;
        const corLength = length + ((4 - (length % 4)) % 4); // table size should be divisible to 4
        const checkSum = calc_checksum(buffer);
        bufSize += corLength;
        return {
            ...table,
            buffer,
            length,
            corLength,
            checkSum,
            offset: 0, // will be set later
        };
    });

    //calculate offsets
    let offset = headerSize;

    const sortedTables = [...tablesWithMetadata].sort((a, b) => a.order - b.order);
    for (const table of sortedTables) {
        table.offset = offset;
        offset += table.corLength;
    }

    //create TTF buffer

    const buf = new MicroBuffer(bufSize);

    //special constants
    const entrySelector = Math.floor(Math.log(TABLES.length) / Math.LN2);
    const searchRange = 2 ** entrySelector * 16;
    const rangeShift = TABLES.length * 16 - searchRange;

    // Add TTF header
    buf.writeUint32(CONST.VERSION);
    buf.writeUint16(TABLES.length);
    buf.writeUint16(searchRange);
    buf.writeUint16(entrySelector);
    buf.writeUint16(rangeShift);

    for (const table of tablesWithMetadata) {
        buf.writeUint32(utils.identifier(table.innerName)); //inner name
        buf.writeUint32(table.checkSum); //checksum
        buf.writeUint32(table.offset); //offset
        buf.writeUint32(table.length); //length
    }

    let headOffset = 0;

    for (const table of sortedTables) {
        if (table.innerName === "head") {
            //we must store head offset to write font checksum
            headOffset = buf.tell();
        }
        buf.writeBytes(table.buffer.buffer);
        for (let i = table.length; i < table.corLength; i++) {
            //align table to be divisible to 4
            buf.writeUint8(0);
        }
    }

    // Write font checksum (corrected by magic value) into HEAD table
    buf.setUint32(headOffset + 8, ulong(CONST.CHECKSUM_ADJUSTMENT - calc_checksum(buf)));

    return buf;
}

export default generateTTF;
