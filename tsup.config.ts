import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        "svg2ttf": "src/svg2ttf.ts",
        "index": "src/index.ts",
    },
    sourcemap: false,
    minify: true,
    splitting: false,
    clean: true,
    dts: true,
    format: ["esm"],
    outDir: "build",
});
