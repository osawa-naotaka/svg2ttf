import { DOMParser } from "@xmldom/xmldom";
import cubic2quad from "cubic2quad";
import svgpath from "svgpath";
import type { Glyph } from "./sfnt.js";
import ucs2 from "./ucs2.js";

interface SvgGlyph {
    d: string;
    unicode: number[];
    name?: string;
    width?: number;
    height?: number;
    character?: string;
    ligature?: string;
    ligatureCodes?: number[];
    sfntGlyph?: Glyph;
    canonical?: SvgGlyph;
}

interface SvgLigature {
    ligature: string;
    unicode: number[];
    glyph: SvgGlyph;
}

interface SvgFont {
    id: string;
    familyName: string;
    subfamilyName: string;
    stretch: string;
    metadata?: string;
    width?: number;
    height?: number;
    horizOriginX?: number;
    horizOriginY?: number;
    vertOriginX?: number;
    vertOriginY?: number;
    ascent?: number;
    descent?: number;
    unitsPerEm?: number;
    capHeight?: number;
    xHeight?: number;
    underlineThickness?: number;
    underlinePosition?: number;
    weightClass?: string | number;
    missingGlyph?: {
        d: string;
        width?: number;
        height?: number;
    };
    glyphs: SvgGlyph[];
    ligatures: SvgLigature[];
}

interface SfntPoint {
    x: number;
    y: number;
    onCurve: boolean;
}

function getGlyph(glyphElem: Element, fontInfo: SvgFont): SvgGlyph {
    const glyph: SvgGlyph = {
        d: "",
        unicode: [],
    };

    if (glyphElem.hasAttribute("d")) {
        glyph.d = glyphElem.getAttribute("d")?.trim() ?? "";
    } else {
        // try nested <path>
        const pathElem = glyphElem.getElementsByTagName("path")[0];

        if (pathElem?.hasAttribute("d")) {
            // <path> has reversed Y axis
            glyph.d = svgpath(pathElem.getAttribute("d") ?? "")
                .scale(1, -1)
                .translate(0, fontInfo.ascent ?? 0)
                .toString();
        } else {
            throw new Error("Can't find 'd' attribute of <glyph> tag.");
        }
    }

    if (glyphElem.getAttribute("unicode")) {
        glyph.character = glyphElem.getAttribute("unicode") ?? "";
        const unicode = ucs2.decode(glyph.character);

        // If more than one code point is involved, the glyph is a ligature glyph
        if (unicode.length > 1) {
            glyph.ligature = glyph.character;
            glyph.ligatureCodes = unicode;
        } else {
            glyph.unicode.push(unicode[0]);
        }
    }

    glyph.name = glyphElem.getAttribute("glyph-name") ?? undefined;

    if (glyphElem.getAttribute("horiz-adv-x")) {
        glyph.width = Number.parseInt(glyphElem.getAttribute("horiz-adv-x") ?? "0", 10);
    }

    return glyph;
}

function deduplicateGlyps(glyphs: SvgGlyph[], ligatures: SvgLigature[]): SvgGlyph[] {
    // Result (the list of unique glyphs)
    const result: SvgGlyph[] = [];

    for (const glyph of glyphs) {
        // Search for glyphs with the same properties (width and d)
        const canonical = result.find((g) => g.width === glyph.width && g.d === glyph.d);

        if (canonical) {
            // Add the code points to the unicode array.
            // The fields "name" and "character" are not that important so we leave them how we first enounter them and throw the rest away
            canonical.unicode = canonical.unicode.concat(glyph.unicode);
            glyph.canonical = canonical;
        } else {
            result.push(glyph);
        }
    }

    // Update ligatures to point to the canonical version
    for (const ligature of ligatures) {
        while ("canonical" in ligature.glyph) {
            ligature.glyph = ligature.glyph.canonical as SvgGlyph;
        }
    }

    return result;
}

export function load(str: string): SvgFont {
    const doc = new DOMParser().parseFromString(str, "application/xml");

    const metadata = doc.getElementsByTagName("metadata")[0];
    const fontElem = doc.getElementsByTagName("font")[0];

    if (!fontElem) {
        throw new Error("Can't find <font> tag. Make sure you SVG file is font, not image.");
    }

    const fontFaceElem = fontElem.getElementsByTagName("font-face")[0];

    const familyName = fontFaceElem.getAttribute("font-family") || "fontello";
    const subfamilyName = fontFaceElem.getAttribute("font-style") || "Regular";
    const id =
        fontElem.getAttribute("id") || `${familyName}-${subfamilyName}`.replace(/[\s()[\]<>%/]/g, "").substring(0, 62);

    const font: SvgFont = {
        id: id,
        familyName: familyName,
        subfamilyName: subfamilyName,
        stretch: fontFaceElem.getAttribute("font-stretch") || "normal",
        glyphs: [],
        ligatures: [],
    };

    // Doesn't work with complex content like <strong>Copyright:></strong><em>Fontello</em>
    if (metadata?.textContent) {
        font.metadata = metadata.textContent;
    }

    // Get <font> numeric attributes
    const fontAttrs: Record<string, string> = {
        width: "horiz-adv-x",
        //height:       'vert-adv-y',
        horizOriginX: "horiz-origin-x",
        horizOriginY: "horiz-origin-y",
        vertOriginX: "vert-origin-x",
        vertOriginY: "vert-origin-y",
    };
    for (const [key, val] of Object.entries(fontAttrs)) {
        if (fontElem.hasAttribute(val)) {
            (font as any)[key] = Number.parseInt(fontElem.getAttribute(val) ?? "0", 10);
        }
    }

    // Get <font-face> numeric attributes
    const faceAttrs: Record<string, string> = {
        ascent: "ascent",
        descent: "descent",
        unitsPerEm: "units-per-em",
        capHeight: "cap-height",
        xHeight: "x-height",
        underlineThickness: "underline-thickness",
        underlinePosition: "underline-position",
    };
    for (const [key, val] of Object.entries(faceAttrs)) {
        if (fontFaceElem.hasAttribute(val)) {
            (font as any)[key] = Number.parseInt(fontFaceElem.getAttribute(val) ?? "0", 10);
        }
    }

    if (fontFaceElem.hasAttribute("font-weight")) {
        font.weightClass = fontFaceElem.getAttribute("font-weight") ?? undefined;
    }

    const missingGlyphElem = fontElem.getElementsByTagName("missing-glyph")[0];

    if (missingGlyphElem) {
        font.missingGlyph = {
            d: missingGlyphElem.getAttribute("d") || "",
        };

        if (missingGlyphElem.getAttribute("horiz-adv-x")) {
            font.missingGlyph.width = Number.parseInt(missingGlyphElem.getAttribute("horiz-adv-x") ?? "0", 10);
        }
    }

    let glyphs: SvgGlyph[] = [];
    const ligatures: SvgLigature[] = [];

    for (const glyphElem of Array.from(fontElem.getElementsByTagName("glyph"))) {
        const glyph = getGlyph(glyphElem, font);

        if ("ligature" in glyph) {
            ligatures.push({
                ligature: glyph.ligature as string,
                unicode: glyph.ligatureCodes as number[],
                glyph: glyph,
            });
        }

        glyphs.push(glyph);
    }

    glyphs = deduplicateGlyps(glyphs, ligatures);

    font.glyphs = glyphs;
    font.ligatures = ligatures;

    return font;
}

export function cubicToQuad(segment: any[], _index: number, x: number, y: number, accuracy: number): any[] | undefined {
    if (segment[0] === "C") {
        const quadCurves = cubic2quad(
            x,
            y,
            segment[1],
            segment[2],
            segment[3],
            segment[4],
            segment[5],
            segment[6],
            accuracy,
        );

        const res: any[] = [];

        for (let i = 2; i < quadCurves.length; i += 4) {
            res.push(["Q", quadCurves[i], quadCurves[i + 1], quadCurves[i + 2], quadCurves[i + 3]]);
        }
        return res;
    }
}

// Converts svg points to contours.  All points must be converted
// to relative ones, smooth curves must be converted to generic ones
// before this conversion.
//
export function toSfntCoutours(svgPath: any): SfntPoint[][] {
    const resContours: SfntPoint[][] = [];
    let resContour: SfntPoint[] = [];

    svgPath.iterate((segment: any[], index: number, x: number, y: number) => {
        //start new contour
        if (index === 0 || segment[0] === "M") {
            resContour = [];
            resContours.push(resContour);
        }

        const name = segment[0];

        if (name === "Q") {
            //add control point of quad spline, it is not on curve
            resContour.push({ x: segment[1], y: segment[2], onCurve: false });
        }

        // add on-curve point
        if (name === "H") {
            // vertical line has Y coordinate only, X remains the same
            resContour.push({ x: segment[1], y: y, onCurve: true });
        } else if (name === "V") {
            // horizontal line has X coordinate only, Y remains the same
            resContour.push({ x: x, y: segment[1], onCurve: true });
        } else if (name !== "Z") {
            // for all commands (except H and V) X and Y are placed in the end of the segment
            resContour.push({ x: segment[segment.length - 2], y: segment[segment.length - 1], onCurve: true });
        }
    });
    return resContours;
}
