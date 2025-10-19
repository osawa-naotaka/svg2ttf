// See documentation here: http://www.microsoft.com/typography/otspec/cmap.htm

import MicroBuffer from "../../microbuffer";
import type { Font, Glyph } from "../../sfnt.js";

function getIDByUnicode(font: Font, unicode: number): number {
    return font.codePoints[unicode] ? font.codePoints[unicode].id : 0;
}

interface Segment {
    start: number;
    end: number;
    length: number;
}

// Calculate character segments with non-interruptable chains of unicodes
function getSegments(font: Font, bounds?: number): Segment[] {
    bounds = bounds || Number.MAX_VALUE;

    const result: Segment[] = [];
    let segment: Segment | undefined;

    // prevEndCode only changes when a segment closes
    for (const [unicode, _glyph] of Object.entries(font.codePoints)) {
        const unicodeNum = Number.parseInt(unicode, 10);
        if (unicodeNum >= bounds) {
            break;
        }
        // Initialize first segment or add new segment if code "hole" is found
        if (!segment || unicodeNum !== segment.end + 1) {
            if (segment) {
                result.push(segment);
            }
            segment = {
                start: unicodeNum,
                end: unicodeNum,
                length: 0,
            };
        }
        segment.end = unicodeNum;
    }

    // Need to finish the last segment
    if (segment) {
        result.push(segment);
    }

    for (const segment of result) {
        segment.length = segment.end - segment.start + 1;
    }

    return result;
}

interface CodePoint {
    unicode: number;
    glyph: Glyph;
}

// Returns an array of {unicode, glyph} sets for all valid code points up to bounds
function getCodePoints(codePoints: any, bounds?: number): CodePoint[] {
    bounds = bounds || Number.MAX_VALUE;

    const result: CodePoint[] = [];

    for (const [unicode, glyph] of Object.entries(codePoints)) {
        const unicodeNum = Number.parseInt(unicode, 10);
        // Since this is a sparse array, iterating will only yield the valid code points
        if (unicodeNum > bounds) {
            break;
        }
        result.push({
            unicode: unicodeNum,
            glyph: glyph as any,
        });
    }
    return result;
}

interface BufferWithOffset extends MicroBuffer {
    _tableOffset?: number;
}

function bufferForTable(format: number, length: number): MicroBuffer {
    const fieldWidth = format === 8 || format === 10 || format === 12 || format === 13 ? 4 : 2;

    length +=
        0 +
        fieldWidth + // Format
        fieldWidth + // Length
        fieldWidth; // Language

    const LANGUAGE = 0;
    const buffer = new MicroBuffer(length);

    const writer = fieldWidth === 4 ? buffer.writeUint32 : buffer.writeUint16;

    // Format specifier
    buffer.writeUint16(format);
    if (fieldWidth === 4) {
        // In case of formats 8.…, 10.…, 12.… and 13.…, this is the decimal part of the format number
        // But since have not been any point releases, this can be zero in that case as well
        buffer.writeUint16(0);
    }
    // Length
    writer.call(buffer, length);
    // Language code (0, only used for legacy quickdraw tables)
    writer.call(buffer, LANGUAGE);

    return buffer;
}

function createFormat0Table(font: Font): MicroBuffer {
    const FORMAT = 0;

    const length = 0xff + 1; //Format 0 maps only single-byte code points

    const buffer = bufferForTable(FORMAT, length);

    for (let i = 0; i < length; i++) {
        buffer.writeUint8(getIDByUnicode(font, i)); // existing char in table 0..255
    }
    return buffer;
}

function createFormat4Table(font: Font): MicroBuffer {
    const FORMAT = 4;

    const segments = getSegments(font, 0xffff);
    const glyphIndexArrays: number[][] = [];

    for (const segment of segments) {
        const glyphIndexArray: number[] = [];

        for (let unicode = segment.start; unicode <= segment.end; unicode++) {
            glyphIndexArray.push(getIDByUnicode(font, unicode));
        }
        glyphIndexArrays.push(glyphIndexArray);
    }

    const segCount = segments.length + 1; // + 1 for the 0xFFFF section
    const glyphIndexArrayLength = glyphIndexArrays.map(arr => arr.length).reduce((result, count) => result + count, 0);

    const length =
        0 +
        2 + // segCountX2
        2 + // searchRange
        2 + // entrySelector
        2 + // rangeShift
        2 * segCount + // endCodes
        2 + // Padding
        2 * segCount + //startCodes
        2 * segCount + //idDeltas
        2 * segCount + //idRangeOffsets
        2 * glyphIndexArrayLength;

    const buffer = bufferForTable(FORMAT, length);

    buffer.writeUint16(segCount * 2); // segCountX2
    const maxExponent = Math.floor(Math.log(segCount) / Math.LN2);
    const searchRange = 2 * 2 ** maxExponent;

    buffer.writeUint16(searchRange); // searchRange
    buffer.writeUint16(maxExponent); // entrySelector
    buffer.writeUint16(2 * segCount - searchRange); // rangeShift

    // Array of end counts
    for (const segment of segments) {
        buffer.writeUint16(segment.end);
    }
    buffer.writeUint16(0xffff); // endCountArray should be finished with 0xFFFF

    buffer.writeUint16(0); // reservedPad

    // Array of start counts
    for (const segment of segments) {
        buffer.writeUint16(segment.start); //startCountArray
    }
    buffer.writeUint16(0xffff); // startCountArray should be finished with 0xFFFF

    // Array of deltas. Leave it zero to not complicate things when using the glyph index array
    for (let i = 0; i < segments.length; i++) {
        buffer.writeUint16(0); // delta is always zero because we use the glyph array
    }
    buffer.writeUint16(1); // idDeltaArray should be finished with 1

    // Array of range offsets
    let offset = 0;

    for (let i = 0; i < segments.length; i++) {
        buffer.writeUint16(2 * (segments.length - i + 1 + offset));
        offset += glyphIndexArrays[i].length;
    }
    buffer.writeUint16(0); // rangeOffsetArray should be finished with 0

    for (const glyphIndexArray of glyphIndexArrays) {
        for (const glyphId of glyphIndexArray) {
            buffer.writeUint16(glyphId);
        }
    }

    return buffer;
}

function createFormat12Table(font: Font): MicroBuffer {
    const FORMAT = 12;

    const codePoints = getCodePoints(font.codePoints);

    const length =
        0 +
        4 + // nGroups
        4 * codePoints.length + // startCharCode
        4 * codePoints.length + // endCharCode
        4 * codePoints.length; // startGlyphCode

    const buffer = bufferForTable(FORMAT, length);

    buffer.writeUint32(codePoints.length); // nGroups
    for (const codePoint of codePoints) {
        buffer.writeUint32(codePoint.unicode); // startCharCode
        buffer.writeUint32(codePoint.unicode); // endCharCode
        buffer.writeUint32(codePoint.glyph.id); // startGlyphCode
    }

    return buffer;
}

interface TableHeader {
    platformID: number;
    encodingID: number;
    table: BufferWithOffset;
}

function createCMapTable(font: Font): MicroBuffer {
    const TABLE_HEAD =
        0 +
        2 + // platform
        2 + // encoding
        4; // offset

    const singleByteTable = createFormat0Table(font) as BufferWithOffset;
    const twoByteTable = createFormat4Table(font) as BufferWithOffset;
    const fourByteTable = createFormat12Table(font) as BufferWithOffset;

    // Subtable headers must be sorted by platformID, encodingID
    const tableHeaders: TableHeader[] = [
        // subtable 4, unicode
        {
            platformID: 0,
            encodingID: 3,
            table: twoByteTable,
        },
        // subtable 12, unicode
        {
            platformID: 0,
            encodingID: 4,
            table: fourByteTable,
        },
        // subtable 0, mac standard
        {
            platformID: 1,
            encodingID: 0,
            table: singleByteTable,
        },
        // subtable 4, windows standard, identical to the unicode table
        {
            platformID: 3,
            encodingID: 1,
            table: twoByteTable,
        },
        // subtable 12, windows ucs4
        {
            platformID: 3,
            encodingID: 10,
            table: fourByteTable,
        },
    ];

    const tables = [twoByteTable, singleByteTable, fourByteTable];

    let tableOffset =
        0 +
        2 + // version
        2 + // number of subtable headers
        tableHeaders.length * TABLE_HEAD;

    // Calculate offsets for each table
    for (const table of tables) {
        table._tableOffset = tableOffset;
        tableOffset += table.length;
    }

    const length = tableOffset;

    const buffer = new MicroBuffer(length);

    // Write table header.
    buffer.writeUint16(0); // version
    buffer.writeUint16(tableHeaders.length); // count

    // Write subtable headers
    for (const header of tableHeaders) {
        buffer.writeUint16(header.platformID); // platform
        buffer.writeUint16(header.encodingID); // encoding
        buffer.writeUint32(header.table._tableOffset as number); // offset
    }

    // Write subtables
    for (const table of tables) {
        buffer.writeBytes(table.buffer);
    }

    return buffer;
}

export default createCMapTable;
