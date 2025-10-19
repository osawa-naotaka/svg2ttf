import toTTF from "./ttf.js";

export interface Panose {
    familyType: number;
    serifStyle: number;
    weight: number;
    proportion: number;
    contrast: number;
    strokeVariation: number;
    armStyle: number;
    letterform: number;
    midline: number;
    xHeight: number;
}

export interface SfntName {
    id: number;
    value: string;
}

export class Point {
    onCurve: boolean = true;
    x: number = 0;
    y: number = 0;
}

export class Contour {
    points: Point[] = [];
}

export class Glyph {
    contours: Contour[] = [];
    d: string = "";
    id: number = 0;
    codes: number[] = []; // needed for nice validator error output
    height: number = 0;
    name: string = "";
    width: number = 0;
    // TTF-specific properties added during conversion
    ttfContours?: any[];
    ttf_flags?: number[];
    ttf_x?: number[];
    ttf_y?: number[];
    ttf_size?: number;

    get xMin(): number {
        let xMin = 0;
        let hasPoints = false;

        for (const contour of this.contours) {
            for (const point of contour.points) {
                xMin = Math.min(xMin, Math.floor(point.x));
                hasPoints = true;
            }
        }

        if (xMin < -32768) {
            throw new Error(
                `xMin value for glyph ${this.name ? `"${this.name}"` : JSON.stringify(this.codes)} is out of bounds (actual ${xMin}, expected -32768..32767, d="${this.d}")`,
            );
        }
        return hasPoints ? xMin : 0;
    }

    get xMax(): number {
        let xMax = 0;
        let hasPoints = false;

        for (const contour of this.contours) {
            for (const point of contour.points) {
                xMax = Math.max(xMax, -Math.floor(-point.x));
                hasPoints = true;
            }
        }

        if (xMax > 32767) {
            throw new Error(
                `xMax value for glyph ${this.name ? `"${this.name}"` : JSON.stringify(this.codes)} is out of bounds (actual ${xMax}, expected -32768..32767, d="${this.d}")`,
            );
        }
        return hasPoints ? xMax : this.width;
    }

    get yMin(): number {
        let yMin = 0;
        let hasPoints = false;

        for (const contour of this.contours) {
            for (const point of contour.points) {
                yMin = Math.min(yMin, Math.floor(point.y));
                hasPoints = true;
            }
        }

        if (yMin < -32768) {
            throw new Error(
                `yMin value for glyph ${this.name ? `"${this.name}"` : JSON.stringify(this.codes)} is out of bounds (actual ${yMin}, expected -32768..32767, d="${this.d}")`,
            );
        }
        return hasPoints ? yMin : 0;
    }

    get yMax(): number {
        let yMax = 0;
        let hasPoints = false;

        for (const contour of this.contours) {
            for (const point of contour.points) {
                yMax = Math.max(yMax, -Math.floor(-point.y));
                hasPoints = true;
            }
        }

        if (yMax > 32767) {
            throw new Error(
                `yMax value for glyph ${this.name ? `"${this.name}"` : JSON.stringify(this.codes)} is out of bounds (actual ${yMax}, expected -32768..32767, d="${this.d}")`,
            );
        }
        return hasPoints ? yMax : 0;
    }
}

export class Font {
    ascent: number = 850;
    copyright: string = "";
    createdDate: Date = new Date();
    glyphs: Glyph[] = [];
    ligatures: any[] = [];
    // Maping of code points to glyphs.
    // Keys are actually numeric, thus should be `parseInt`ed.
    codePoints: Record<number, Glyph> = {};
    isFixedPitch: number = 0;
    italicAngle: number = 0;
    familyClass: number = 0; // No Classification
    familyName: string = "";

    // 0x40 - REGULAR - Characters are in the standard weight/style for the font
    // 0x80 - USE_TYPO_METRICS - use OS/2.sTypoAscender - OS/2.sTypoDescender + OS/2.sTypoLineGap as the default line spacing
    // https://docs.microsoft.com/en-us/typography/opentype/spec/os2#fsselection
    // https://github.com/fontello/svg2ttf/issues/95
    fsSelection: number = 0x40 | 0x80;

    // Non zero value can cause issues in IE, https://github.com/fontello/svg2ttf/issues/45
    fsType: number = 0;
    lowestRecPPEM: number = 8;
    macStyle: number = 0;
    modifiedDate: Date = new Date();
    panose: Panose = {
        familyType: 2, // Latin Text
        serifStyle: 0, // any
        weight: 5, // book
        proportion: 3, //modern
        contrast: 0, //any
        strokeVariation: 0, //any,
        armStyle: 0, //any,
        letterform: 0, //any,
        midline: 0, //any,
        xHeight: 0, //any,
    };
    revision: number = 1;
    sfntNames: SfntName[] = [];
    underlineThickness: number = 0;
    unitsPerEm: number = 1000;
    weightClass: number = 400; // normal
    width: number = 1000;
    widthClass: number = 5; // Medium (normal)
    ySubscriptXOffset: number = 0;
    ySuperscriptXOffset: number = 0;
    private int_descent: number = -150;
    xHeight: number = 0;
    capHeight: number = 0;
    id?: string;
    description?: string;
    url?: string;
    horizOriginX?: number;
    horizOriginY?: number;
    vertOriginX?: number;
    vertOriginY?: number;
    height?: number;

    // Optional internal properties for computed getters/setters
    private int_ySubscriptXSize?: number;
    private int_ySubscriptYSize?: number;
    private int_ySubscriptYOffset?: number;
    private int_ySuperscriptXSize?: number;
    private int_ySuperscriptYSize?: number;
    private int_ySuperscriptYOffset?: number;
    private int_yStrikeoutSize?: number;
    private int_yStrikeoutPosition?: number;
    private int_lineGap?: number;
    private int_underlinePosition?: number;

    // TTF-specific properties added during conversion
    ttf_glyph_size?: number;

    get descent(): number {
        return this.int_descent;
    }

    set descent(value: number) {
        this.int_descent = Number.parseInt(Math.round(-Math.abs(value)).toString(), 10);
    }

    get avgCharWidth(): number {
        if (this.glyphs.length === 0) {
            return 0;
        }
        const widths = this.glyphs.map((g) => g.width);

        return Number.parseInt((widths.reduce((prev, cur) => prev + cur) / widths.length).toString(), 10);
    }

    get ySubscriptXSize(): number {
        return Number.parseInt(
            (this.int_ySubscriptXSize !== undefined ? this.int_ySubscriptXSize : this.width * 0.6347).toString(),
            10,
        );
    }

    set ySubscriptXSize(value: number) {
        this.int_ySubscriptXSize = value;
    }

    get ySubscriptYSize(): number {
        return Number.parseInt(
            (this.int_ySubscriptYSize !== undefined
                ? this.int_ySubscriptYSize
                : (this.ascent - this.descent) * 0.7
            ).toString(),
            10,
        );
    }

    set ySubscriptYSize(value: number) {
        this.int_ySubscriptYSize = value;
    }

    get ySubscriptYOffset(): number {
        return Number.parseInt(
            (this.int_ySubscriptYOffset !== undefined
                ? this.int_ySubscriptYOffset
                : (this.ascent - this.descent) * 0.14
            ).toString(),
            10,
        );
    }

    set ySubscriptYOffset(value: number) {
        this.int_ySubscriptYOffset = value;
    }

    get ySuperscriptXSize(): number {
        return Number.parseInt(
            (this.int_ySuperscriptXSize !== undefined ? this.int_ySuperscriptXSize : this.width * 0.6347).toString(),
            10,
        );
    }

    set ySuperscriptXSize(value: number) {
        this.int_ySuperscriptXSize = value;
    }

    get ySuperscriptYSize(): number {
        return Number.parseInt(
            (this.int_ySuperscriptYSize !== undefined
                ? this.int_ySuperscriptYSize
                : (this.ascent - this.descent) * 0.7
            ).toString(),
            10,
        );
    }

    set ySuperscriptYSize(value: number) {
        this.int_ySuperscriptYSize = value;
    }

    get ySuperscriptYOffset(): number {
        return Number.parseInt(
            (this.int_ySuperscriptYOffset !== undefined
                ? this.int_ySuperscriptYOffset
                : (this.ascent - this.descent) * 0.48
            ).toString(),
            10,
        );
    }

    set ySuperscriptYOffset(value: number) {
        this.int_ySuperscriptYOffset = value;
    }

    get yStrikeoutSize(): number {
        return Number.parseInt(
            (this.int_yStrikeoutSize !== undefined
                ? this.int_yStrikeoutSize
                : (this.ascent - this.descent) * 0.049
            ).toString(),
            10,
        );
    }

    set yStrikeoutSize(value: number) {
        this.int_yStrikeoutSize = value;
    }

    get yStrikeoutPosition(): number {
        return Number.parseInt(
            (this.int_yStrikeoutPosition !== undefined
                ? this.int_yStrikeoutPosition
                : (this.ascent - this.descent) * 0.258
            ).toString(),
            10,
        );
    }

    set yStrikeoutPosition(value: number) {
        this.int_yStrikeoutPosition = value;
    }

    get minLsb(): number {
        return Number.parseInt((Math.min(...this.glyphs.map((g) => g.xMin)) || 0).toString(), 10);
    }

    get minRsb(): number {
        if (!this.glyphs.length) return Number.parseInt(this.width.toString(), 10);

        return Number.parseInt(
            this.glyphs.reduce((minRsb, glyph) => Math.min(minRsb, glyph.width - glyph.xMax), 0).toString(),
            10,
        );
    }

    get xMin(): number {
        if (!this.glyphs.length) return this.width;

        return this.glyphs.reduce((xMin, glyph) => Math.min(xMin, glyph.xMin), 0);
    }

    get yMin(): number {
        if (!this.glyphs.length) return this.width;

        return this.glyphs.reduce((yMin, glyph) => Math.min(yMin, glyph.yMin), 0);
    }

    get xMax(): number {
        if (!this.glyphs.length) return this.width;

        return this.glyphs.reduce((xMax, glyph) => Math.max(xMax, glyph.xMax), 0);
    }

    get yMax(): number {
        if (!this.glyphs.length) return this.width;

        return this.glyphs.reduce((yMax, glyph) => Math.max(yMax, glyph.yMax), 0);
    }

    get avgWidth(): number {
        const len = this.glyphs.length;

        if (len === 0) {
            return this.width;
        }

        const sumWidth = this.glyphs.reduce((sumWidth, glyph) => sumWidth + glyph.width, 0);

        return Math.round(sumWidth / len);
    }

    get maxWidth(): number {
        if (!this.glyphs.length) return this.width;

        return this.glyphs.reduce((maxWidth, glyph) => Math.max(maxWidth, glyph.width), 0);
    }

    get maxExtent(): number {
        if (!this.glyphs.length) return this.width;

        return this.glyphs.reduce((maxExtent, glyph) => Math.max(maxExtent, glyph.xMax /*- glyph.xMin*/), 0);
    }

    // Property used for `sTypoLineGap` in OS/2 and not used for `lineGap` in HHEA, because
    // non zero lineGap causes bad offset in IE, https://github.com/fontello/svg2ttf/issues/37
    get lineGap(): number {
        return Number.parseInt(
            (this.int_lineGap !== undefined ? this.int_lineGap : (this.ascent - this.descent) * 0.09).toString(),
            10,
        );
    }

    set lineGap(value: number) {
        this.int_lineGap = value;
    }

    get underlinePosition(): number {
        return Number.parseInt(
            (this.int_underlinePosition !== undefined
                ? this.int_underlinePosition
                : (this.ascent - this.descent) * 0.01
            ).toString(),
            10,
        );
    }

    set underlinePosition(value: number) {
        this.int_underlinePosition = value;
    }
}

export { toTTF };
