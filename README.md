# svg2ttf

Converts SVG fonts to TTF format. Originally written for [Fontello](http://fontello.com), this tool can be useful for various font conversion projects.

@lulliecat/svg2ttf is a security-updated fork of the original svg2ttf. The development environment has been modernized, and TypeScript type definitions will be provided in future releases.

## For Developers

The internal API is similar to FontForge's API. Since the primary goal is generating icon fonts, some specific TTF/OTF features (such as kerning) may not be fully supported. However, the current codebase provides a solid foundation for development, saving you significant time in implementing correct TTF table writing and optimization.


## Installation

Install globally via npm:

```bash
npm install -g @lulliecat/svg2ttf
```

## CLI Usage

Convert an SVG font to TTF format:

```bash
svg2ttf fontello.svg fontello.ttf
```

## API

### svg2ttf(svgFontString, options) -> buf

**Parameters:**

- `svgFontString` (string) - SVG font content as a string
- `options` (object) - Configuration options
  - `copyright` (string, optional) - Copyright text
  - `description` (string, optional) - Font description
  - `ts` (number, optional) - Unix timestamp in seconds to override creation time
  - `url` (string, optional) - Manufacturer URL
  - `version` (string, optional) - Font version string (e.g., `Version x.y` or `x.y`)

**Returns:**

- `buf` - Internal [byte buffer](https://github.com/fontello/microbuffer) object, similar to DataView. The `buffer` property contains a `Uint8Array` or `Array` with the TTF content.

**Example:**

```javascript
const fs = require('fs');
const svg2ttf = require('@lulliecat/svg2ttf');

const ttf = svg2ttf(fs.readFileSync('myfont.svg', 'utf8'), {});
fs.writeFileSync('myfont.ttf', Buffer.from(ttf.buffer));
```

