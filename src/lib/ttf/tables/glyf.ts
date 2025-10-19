// See documentation here: http://www.microsoft.com/typography/otspec/glyf.htm

import MicroBuffer from "../../microbuffer";
import type { Font, Glyph } from "../../sfnt.js";

function getFlags(glyph: Glyph): number[] {
    const result: number[] = [];

    for (const contour of glyph.ttfContours ?? []) {
        for (const point of contour) {
            let flag = point.onCurve ? 1 : 0;

            if (point.x === 0) {
                flag += 16;
            } else {
                if (-0xff <= point.x && point.x <= 0xff) {
                    flag += 2; // the corresponding x-coordinate is 1 byte long
                }
                if (point.x > 0 && point.x <= 0xff) {
                    flag += 16; // If x-Short Vector is set, this bit describes the sign of the value, with 1 equalling positive and 0 negative
                }
            }
            if (point.y === 0) {
                flag += 32;
            } else {
                if (-0xff <= point.y && point.y <= 0xff) {
                    flag += 4; // the corresponding y-coordinate is 1 byte long
                }
                if (point.y > 0 && point.y <= 0xff) {
                    flag += 32; // If y-Short Vector is set, this bit describes the sign of the value, with 1 equalling positive and 0 negative.
                }
            }
            result.push(flag);
        }
    }
    return result;
}

//repeating flags can be packed
function compactFlags(flags: number[]): number[] {
    const result: number[] = [];
    let prevFlag = -1;
    let firstRepeat = false;

    for (const flag of flags) {
        if (prevFlag === flag) {
            if (firstRepeat) {
                result[result.length - 1] += 8; //current flag repeats previous one, need to set 3rd bit of previous flag and set 1 to the current one
                result.push(1);
                firstRepeat = false;
            } else {
                result[result.length - 1]++; //when flag is repeating second or more times, we need to increase the last flag value
            }
        } else {
            firstRepeat = true;
            prevFlag = flag;
            result.push(flag);
        }
    }
    return result;
}

function getCoords(glyph: Glyph, coordName: string): number[] {
    const result: number[] = [];

    for (const contour of glyph.ttfContours ?? []) {
        result.push(...contour.map((point: any) => point[coordName]));
    }
    return result;
}

function compactCoords(coords: number[]): number[] {
    return coords.filter((coord) => coord !== 0);
}

//calculates length of glyph data in GLYF table
function glyphDataSize(glyph: Glyph): number {
    // Ignore glyphs without outlines. These will get a length of zero in the "loca" table
    if (!glyph.contours.length) {
        return 0;
    }

    let result = 12; //glyph fixed properties

    result += glyph.contours.length * 2; //add contours

    for (const x of glyph.ttf_x ?? []) {
        //add 1 or 2 bytes for each coordinate depending of its size
        result += -0xff <= x && x <= 0xff ? 1 : 2;
    }

    for (const y of glyph.ttf_y ?? []) {
        //add 1 or 2 bytes for each coordinate depending of its size
        result += -0xff <= y && y <= 0xff ? 1 : 2;
    }

    // Add flags length to glyph size.
    result += glyph.ttf_flags.length;

    if (result % 4 !== 0) {
        // glyph size must be divisible by 4.
        result += 4 - (result % 4);
    }
    return result;
}

function tableSize(font: Font): number {
    let result = 0;

    for (const glyph of font.glyphs) {
        glyph.ttf_size = glyphDataSize(glyph);
        result += glyph.ttf_size;
    }
    font.ttf_glyph_size = result; //sum of all glyph lengths
    return result;
}

function createGlyfTable(font: Font): MicroBuffer {
    for (const glyph of font.glyphs) {
        glyph.ttf_flags = getFlags(glyph);
        glyph.ttf_flags = compactFlags(glyph.ttf_flags);
        glyph.ttf_x = getCoords(glyph, "x");
        glyph.ttf_x = compactCoords(glyph.ttf_x);
        glyph.ttf_y = getCoords(glyph, "y");
        glyph.ttf_y = compactCoords(glyph.ttf_y);
    }

    const buf = new MicroBuffer(tableSize(font));

    for (const glyph of font.glyphs) {
        // Ignore glyphs without outlines. These will get a length of zero in the "loca" table
        if (!glyph.contours.length) {
            continue;
        }

        const offset = buf.tell();

        buf.writeInt16(glyph.contours.length); // numberOfContours
        buf.writeInt16(glyph.xMin); // xMin
        buf.writeInt16(glyph.yMin); // yMin
        buf.writeInt16(glyph.xMax); // xMax
        buf.writeInt16(glyph.yMax); // yMax

        // Array of end points
        let endPtsOfContours = -1;

        const ttfContours = glyph.ttfContours;

        for (const contour of ttfContours ?? []) {
            endPtsOfContours += contour.length;
            buf.writeInt16(endPtsOfContours);
        }

        buf.writeInt16(0); // instructionLength, is not used here

        // Array of flags
        for (const flag of glyph.ttf_flags ?? []) {
            buf.writeInt8(flag);
        }

        // Array of X relative coordinates
        for (const x of glyph.ttf_x ?? []) {
            if (-0xff <= x && x <= 0xff) {
                buf.writeUint8(Math.abs(x));
            } else {
                buf.writeInt16(x);
            }
        }

        // Array of Y relative coordinates
        for (const y of glyph.ttf_y ?? []) {
            if (-0xff <= y && y <= 0xff) {
                buf.writeUint8(Math.abs(y));
            } else {
                buf.writeInt16(y);
            }
        }

        let tail = (buf.tell() - offset) % 4;

        if (tail !== 0) {
            // glyph size must be divisible by 4.
            for (; tail < 4; tail++) {
                buf.writeUint8(0);
            }
        }
    }
    return buf;
}

export default createGlyfTable;
