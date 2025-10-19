// See documentation here: http://www.microsoft.com/typography/otspec/name.htm

import MicroBuffer from "../../microbuffer";
import type { Font } from "../../sfnt.js";
import Str from "../../str.js";

const TTF_NAMES = {
    COPYRIGHT: 0,
    FONT_FAMILY: 1,
    ID: 3,
    DESCRIPTION: 10,
    URL_VENDOR: 11,
};

interface NameRecord {
    data: number[];
    id: number;
    platformID: number;
    encodingID: number;
    languageID: number;
}

function tableSize(names: NameRecord[]): number {
    let result = 6; // table header

    for (const name of names) {
        result += 12 + name.data.length; //name header and data
    }
    return result;
}

function getStrings(name: string, id: number): NameRecord[] {
    const result: NameRecord[] = [];
    const str = new Str(name);

    result.push({ data: str.toUTF8Bytes(), id: id, platformID: 1, encodingID: 0, languageID: 0 }); //mac standard
    result.push({ data: str.toUCS2Bytes(), id: id, platformID: 3, encodingID: 1, languageID: 0x409 }); //windows standard
    return result;
}

// Collect font names
function getNames(font: Font): NameRecord[] {
    const result: NameRecord[] = [];

    if (font.copyright) {
        result.push.apply(result, getStrings(font.copyright, TTF_NAMES.COPYRIGHT));
    }
    if (font.familyName) {
        result.push.apply(result, getStrings(font.familyName, TTF_NAMES.FONT_FAMILY));
    }
    if (font.id) {
        result.push.apply(result, getStrings(font.id, TTF_NAMES.ID));
    }
    result.push.apply(result, getStrings(font.description, TTF_NAMES.DESCRIPTION));
    result.push.apply(result, getStrings(font.url, TTF_NAMES.URL_VENDOR));

    for (const sfntName of font.sfntNames) {
        result.push.apply(result, getStrings(sfntName.value, sfntName.id));
    }

    result.sort((a, b) => {
        const orderFields: (keyof NameRecord)[] = ["platformID", "encodingID", "languageID", "id"];

        for (let i = 0; i < orderFields.length; i++) {
            if (a[orderFields[i]] !== b[orderFields[i]]) {
                return a[orderFields[i]] < b[orderFields[i]] ? -1 : 1;
            }
        }
        return 0;
    });

    return result;
}

function createNameTable(font: Font): MicroBuffer {
    const names = getNames(font);

    const buf = new MicroBuffer(tableSize(names));

    buf.writeUint16(0); // formatSelector
    buf.writeUint16(names.length); // nameRecordsCount
    const offsetPosition = buf.tell();

    buf.writeUint16(0); // offset, will be filled later
    let nameOffset = 0;

    for (const name of names) {
        buf.writeUint16(name.platformID); // platformID
        buf.writeUint16(name.encodingID); // platEncID
        buf.writeUint16(name.languageID); // languageID, English (USA)
        buf.writeUint16(name.id); // nameID
        buf.writeUint16(name.data.length); // reclength
        buf.writeUint16(nameOffset); // offset
        nameOffset += name.data.length;
    }
    const actualStringDataOffset = buf.tell();

    //Array of bytes with actual string data
    for (const name of names) {
        buf.writeBytes(name.data);
    }

    //write actual string data offset
    buf.seek(offsetPosition);
    buf.writeUint16(actualStringDataOffset); // offset

    return buf;
}

export default createNameTable;
