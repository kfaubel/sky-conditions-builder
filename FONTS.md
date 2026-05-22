# Font Configuration for sky-conditions-builder

## Issue
The pureimage library requires fonts to be explicitly registered before text can be rendered. Without font registration, labels and text will not appear on the generated images.

## Solution
To enable text rendering (title, time labels, location labels, row labels), you need to register a TrueType font (.ttf) file with pureimage.

## Example Implementation

```typescript
import * as PImage from "pureimage";
import * as fs from "fs";
import * as path from "path";

// Register a font before using SkyConditionsImage
const fontPath = path.join(__dirname, "fonts", "OpenSans-Regular.ttf");
const font = PImage.registerFont(fontPath, "sans-serif");
font.loadSync(); // or use font.load() for async

// Now you can use SkyConditionsImage and text will render
const builder = new SkyConditionsBuilder(logger);
const result = await builder.getImageStream(config);
```

## Font Files
You'll need to:
1. Obtain a TrueType font file (e.g., OpenSans, Arial, etc.)
2. Place it in your project (e.g., in a `fonts/` directory)
3. Register it before generating images

## Recommended Fonts
- **Open Sans** - Available from Google Fonts (open source)
- **Roboto** - Available from Google Fonts (open source)
- **DejaVu Sans** - Available in most Linux distributions (open source)

## Note
The current implementation works without font registration - all data visualization (colored squares) renders correctly. Only text labels are affected.
