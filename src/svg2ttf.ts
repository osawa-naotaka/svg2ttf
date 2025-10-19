#!/usr/bin/env node
/*
 Author: Sergey Batishchev <sergej.batishchev@gmail.com>

 Written for fontello.com project.
 */

/*eslint-disable no-console*/

import fs from "node:fs";
import { ArgumentParser } from "argparse";
import svg2ttf from "./index.js";
import packageJson from "../package.json" with { type: "json" };

const parser = new ArgumentParser({
    add_help: true,
    description: "SVG to TTF font converter",
});

parser.add_argument("-v", "--version", {
    action: "version",
    version: packageJson.version,
});

parser.add_argument("-c", "--copyright", {
    help: "Copyright text",
    required: false,
});

parser.add_argument("-d", "--description", {
    help: "Override default description text",
    required: false,
    type: "str",
});

parser.add_argument("--ts", {
    help: "Override font creation time (Unix time stamp)",
    required: false,
    type: "int",
});

parser.add_argument("-u", "--url", {
    help: "Override default manufacturer url",
    required: false,
    type: "str",
});

parser.add_argument("--vs", {
    help: 'Override default font version string (Version 1.0), can be "x.y" or "Version x.y"',
    required: false,
    type: "str",
});

parser.add_argument("infile", {
    nargs: 1,
    help: "Input file",
});

parser.add_argument("outfile", {
    nargs: 1,
    help: "Output file",
});

const args = parser.parse_args();
let svg: string;
const options: {
    copyright?: string;
    description?: string;
    ts?: number;
    url?: string;
    version?: string;
} = {};

try {
    svg = fs.readFileSync(args.infile[0], "utf-8");
} catch (e) {
    console.error("Can't open input file (%s)", args.infile[0]);
    process.exit(1);
}

if (args.copyright) options.copyright = args.copyright;

if (args.description) options.description = args.description;

if (args.ts !== null) options.ts = args.ts;

if (args.url) options.url = args.url;

if (args.vs) options.version = args.vs;

const result = Buffer.from(svg2ttf(svg, options).buffer);

fs.writeFileSync(args.outfile[0], result);
