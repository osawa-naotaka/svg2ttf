// See documentation here: http://www.microsoft.com/typography/otspec/GSUB.htm

import MicroBuffer from "../../microbuffer";
import type { Font, Glyph } from "../../sfnt.js";
import { identifier } from "../utils.js";

interface BufferWithOffset extends MicroBuffer {
    _listOffset?: number;
}

function createScript(): MicroBuffer {
    const scriptRecord =
        0 +
        2 + // Script DefaultLangSys Offset
        2; // Script[0] LangSysCount (0)

    const langSys =
        0 +
        2 + // Script DefaultLangSys LookupOrder
        2 + // Script DefaultLangSys ReqFeatureIndex
        2 + // Script DefaultLangSys FeatureCount (0?)
        2; // Script Optional Feature Index[0]

    const length = 0 + scriptRecord + langSys;

    const buffer = new MicroBuffer(length);

    // Script Record
    // Offset to the start of langSys from the start of scriptRecord
    buffer.writeUint16(scriptRecord); // DefaultLangSys

    // Number of LangSys entries other than the default (none)
    buffer.writeUint16(0);

    // LangSys record (DefaultLangSys)
    // LookupOrder
    buffer.writeUint16(0);
    // ReqFeatureIndex -> only one required feature: all ligatures
    buffer.writeUint16(0);
    // Number of FeatureIndex values for this language system (excludes the required feature)
    buffer.writeUint16(1);
    // FeatureIndex for the first optional feature
    // Note: Adding the same feature to both the optional
    // and the required features is a clear violation of the spec
    // but it fixes IE not displaying the ligatures.
    // See http://partners.adobe.com/public/developer/opentype/index_table_formats.html, Section "Language System Table"
    // "FeatureCount: Number of FeatureIndex values for this language system-*excludes the required feature*" (emphasis added)
    buffer.writeUint16(0);

    return buffer;
}

function createScriptList(): MicroBuffer {
    const scriptSize =
        0 +
        4 + // Tag
        2; // Offset

    // tags should be arranged alphabetically
    const scripts: [string, MicroBuffer][] = [
        ["DFLT", createScript()],
        ["latn", createScript()],
    ];

    const header =
        0 +
        2 + // Script count
        scripts.length * scriptSize;

    const tableLengths = scripts.map((script) => script[1].length).reduce((result, count) => result + count, 0);

    const length = 0 + header + tableLengths;

    const buffer = new MicroBuffer(length);

    // Script count
    buffer.writeUint16(scripts.length);

    // Write all ScriptRecords
    let offset = header;

    for (const script of scripts) {
        const name = script[0];
        const table = script[1];

        // Script identifier (DFLT/latn)
        buffer.writeUint32(identifier(name));
        // Offset to the ScriptRecord from start of the script list
        buffer.writeUint16(offset);
        // Increment offset by script table length
        offset += table.length;
    }

    // Write all ScriptTables
    for (const script of scripts) {
        const table = script[1];

        buffer.writeBytes(table.buffer);
    }

    return buffer;
}

// Write one feature containing all ligatures
function createFeatureList(): MicroBuffer {
    const header =
        0 +
        2 + // FeatureCount
        4 + // FeatureTag[0]
        2; // Feature Offset[0]

    const length =
        0 +
        header +
        2 + // FeatureParams[0]
        2 + // LookupCount[0]
        2; // Lookup[0] LookupListIndex[0]

    const buffer = new MicroBuffer(length);

    // FeatureCount
    buffer.writeUint16(1);
    // FeatureTag[0]
    buffer.writeUint32(identifier("liga"));
    // Feature Offset[0]
    buffer.writeUint16(header);
    // FeatureParams[0]
    buffer.writeUint16(0);
    // LookupCount[0]
    buffer.writeUint16(1);
    // Index into lookup table. Since we only have ligatures, the index is always 0
    buffer.writeUint16(0);

    return buffer;
}

interface LigatureGroup {
    startGlyph: Glyph;
    codePoint: number;
    ligatures: any[];
}

function createLigatureCoverage(_font: Font, ligatureGroups: LigatureGroup[]): MicroBuffer {
    const glyphCount = ligatureGroups.length;

    const length =
        0 +
        2 + // CoverageFormat
        2 + // GlyphCount
        2 * glyphCount; // GlyphID[i]

    const buffer = new MicroBuffer(length);

    // CoverageFormat
    buffer.writeUint16(1);

    // Length
    buffer.writeUint16(glyphCount);

    for (const group of ligatureGroups) {
        buffer.writeUint16(group.startGlyph.id);
    }

    return buffer;
}

function createLigatureTable(font: Font, ligature: any): MicroBuffer {
    const allCodePoints = font.codePoints;

    const unicode = ligature.unicode;

    const length =
        0 +
        2 + // LigGlyph
        2 + // CompCount
        2 * (unicode.length - 1);

    const buffer = new MicroBuffer(length);

    // LigGlyph
    const glyph = ligature.glyph;

    buffer.writeUint16(glyph.id);

    // CompCount
    buffer.writeUint16(unicode.length);

    // Compound glyphs (excluding first as it's already in the coverage table)
    for (let i = 1; i < unicode.length; i++) {
        const glyphRef = allCodePoints[unicode[i]];
        buffer.writeUint16(glyphRef.id);
    }

    return buffer;
}

function createLigatureSet(font: Font, _codePoint: number, ligatures: any[]): MicroBuffer {
    const ligatureTables: MicroBuffer[] = [];

    for (const ligature of ligatures) {
        ligatureTables.push(createLigatureTable(font, ligature));
    }

    const tableLengths = ligatureTables.map((t) => t.length).reduce((result, count) => result + count, 0);

    let offset =
        0 +
        2 + // LigatureCount
        2 * ligatures.length;

    const length = 0 + offset + tableLengths;

    const buffer = new MicroBuffer(length);

    // LigatureCount
    buffer.writeUint16(ligatures.length);

    // Ligature offsets
    for (const table of ligatureTables) {
        // The offset to the current set, from SubstFormat
        buffer.writeUint16(offset);
        offset += table.length;
    }

    // Ligatures
    for (const table of ligatureTables) {
        buffer.writeBytes(table.buffer);
    }

    return buffer;
}

function createLigatureList(font: Font, ligatureGroups: LigatureGroup[]): MicroBuffer {
    const sets: MicroBuffer[] = [];

    for (const group of ligatureGroups) {
        const set = createLigatureSet(font, group.codePoint, group.ligatures);

        sets.push(set);
    }

    const setLengths = sets.map((s) => s.length).reduce((result, count) => result + count, 0);

    const coverage = createLigatureCoverage(font, ligatureGroups);

    const tableOffset =
        0 +
        2 + // Lookup type
        2 + // Lokup flag
        2 + // SubTableCount
        2; // SubTable[0] Offset

    let setOffset =
        0 +
        2 + // SubstFormat
        2 + // Coverage offset
        2 + // LigSetCount
        2 * sets.length; // LigSet Offsets

    const coverageOffset = setOffset + setLengths;

    const length = 0 + tableOffset + coverageOffset + coverage.length;

    const buffer = new MicroBuffer(length);

    // Lookup type 4 – ligatures
    buffer.writeUint16(4);

    // Lookup flag – empty
    buffer.writeUint16(0);

    // Subtable count
    buffer.writeUint16(1);

    // Subtable[0] offset
    buffer.writeUint16(tableOffset);

    // SubstFormat
    buffer.writeUint16(1);

    // Coverage
    buffer.writeUint16(coverageOffset);

    // LigSetCount
    buffer.writeUint16(sets.length);

    for (const set of sets) {
        // The offset to the current set, from SubstFormat
        buffer.writeUint16(setOffset);
        setOffset += set.length;
    }

    for (const set of sets) {
        buffer.writeBytes(set.buffer);
    }

    buffer.writeBytes(coverage.buffer);

    return buffer;
}

// Add a lookup for each ligature
function createLookupList(font: Font): MicroBuffer {
    const ligatures = font.ligatures;

    const groupedLigatures: Record<string, any[]> = {};

    // Group ligatures by first code point
    for (const ligature of ligatures) {
        const first = ligature.unicode[0];

        if (!(first in groupedLigatures)) {
            groupedLigatures[first] = [];
        }
        groupedLigatures[first].push(ligature);
    }

    const ligatureGroups: LigatureGroup[] = [];

    for (const [codePoint, ligatures] of Object.entries(groupedLigatures)) {
        const codePointNum = Number.parseInt(codePoint, 10);
        // Order ligatures by length, descending
        // "Ligatures with more components must be stored ahead of those with fewer components in order to be found"
        // From: http://partners.adobe.com/public/developer/opentype/index_tag7.html#liga
        ligatures.sort((ligA, ligB) => ligB.unicode.length - ligA.unicode.length);
        ligatureGroups.push({
            codePoint: codePointNum,
            ligatures: ligatures,
            startGlyph: font.codePoints[codePointNum],
        });
    }

    ligatureGroups.sort((a, b) => a.startGlyph.id - b.startGlyph.id);

    const offset =
        0 +
        2 + // Lookup count
        2; // Lookup[0] offset

    const set = createLigatureList(font, ligatureGroups);

    const length = 0 + offset + set.length;

    const buffer = new MicroBuffer(length);

    // Lookup count
    buffer.writeUint16(1);

    // Lookup[0] offset
    buffer.writeUint16(offset);

    // Lookup[0]
    buffer.writeBytes(set.buffer);

    return buffer;
}

function createGSUB(font: Font): MicroBuffer {
    const scriptList = createScriptList() as BufferWithOffset;
    const featureList = createFeatureList() as BufferWithOffset;
    const lookupList = createLookupList(font) as BufferWithOffset;

    const lists = [scriptList, featureList, lookupList];

    let offset =
        0 +
        4 + // Version
        2 * lists.length; // List offsets

    // Calculate offsets
    for (const list of lists) {
        list._listOffset = offset;
        offset += list.length;
    }

    const length = offset;
    const buffer = new MicroBuffer(length);

    // Version
    buffer.writeUint32(0x00010000);

    // Offsets
    for (const list of lists) {
        buffer.writeUint16(list._listOffset as number);
    }

    // List contents
    for (const list of lists) {
        buffer.writeBytes(list.buffer);
    }

    return buffer;
}

export default createGSUB;
