**UPDATE: Font Label Issue Resolved**

The labels are not appearing because:

1. **Font must be registered BEFORE importing the module**
2. **Use the wrapper script provided below**

## Working Solution

Use this wrapper script instead of `sample.js`:

```javascript
// font-fix-sample.js
const PImage = require('pureimage');
const fs = require('fs');

// CRITICAL: Load font FIRST before importing SkyConditionsImage
const fontPath = "C:\\Windows\\Fonts\\arial.ttf";
if (fs.existsSync(fontPath)) {
    const fnt = PImage.registerFont(fontPath, "Arial");
    fnt.loadSync();
    console.log("Font loaded");
}

// Now import and use
const { SkyConditionsImage } = require('./index.js');

const logger = {
    info: (...args) => console.log(...args),
    verbose: (...args) => {},  // Silent
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

async function run() {
    const config = {
        "title": "Sky Conditions",
        "baseURL": "https://astrosphericpublicaccess.azurewebsites.net/api/",
        "apiKey": "YOUR_API_KEY",
        "locations": [
            { "label": "Location 1", "latitude": 31.55, "longitude": -99.38, "timezone": "America/Chicago" },
            { "label": "Location 2", "latitude": 42.68, "longitude": -71.47, "timezone": "America/New_York" },
            { "label": "Location 3", "latitude": 41.75, "longitude": -71.25, "timezone": "America/New_York" }
        ]
    };

    const skyImage = new SkyConditionsImage(logger);
    const result = await skyImage.getImageStream(config);
    fs.writeFileSync('sky-conditions.jpg', result.jpegImg.data);
    console.log('Image created: sky-conditions.jpg');
}

run().catch(console.error);
```

## Why This Works

Pure image requires fonts to be registered in the global registry BEFORE any drawing context is created. By loading the font before importing the module, we ensure it's available when needed.

## Next Steps

The TypeScript source needs to be rebuilt with proper font handling. For now, use the wrapper script above.
