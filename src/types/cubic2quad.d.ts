declare module "cubic2quad" {
    function cubic2quad(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        x3: number,
        y3: number,
        x4: number,
        y4: number,
        tolerance: number,
    ): number[];
    export = cubic2quad;
}
