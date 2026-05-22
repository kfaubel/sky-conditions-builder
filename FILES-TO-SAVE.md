# Files to Save Before Starting Over

## CRITICAL - Must Save These

### 1. Requirements File
- **File**: `Requirements`
- **Why**: Contains all clarified requirements AND implementation lessons learned
- **Status**: ✅ Updated with font solution and all learnings

### 2. TypeScript Source Files (src/ directory)
These files are CLEAN and working:

- **src/types.ts** - Type definitions for API responses and config
- **src/Logger.ts** - Logger interface
- **src/AstrosphericAPI.ts** - API client (uses POST, not GET)
- **src/index.ts** - Module entry point

⚠️ **src/SkyConditionsImage.ts** - CORRUPTED, do not save (will need to rebuild)

### 3. Configuration Files
- **package.json** - All dependencies (pureimage 0.4.13, axios, moment-timezone, etc.) and scripts
- **tsconfig.json** - TypeScript compilation settings (ES2020, CommonJS, strict mode)
- **.gitignore** - Git ignore patterns
- **.eslintrc.json** - ESLint configuration
- **.prettierrc** - Code formatting rules
- **.npmignore** - NPM publish exclusions

### 4. Sample Configuration
- **sample-config.json** - Clean example config with 3 locations
  - Shows proper lowercase property names
  - Contains example timezones
  - Template for API key placement
- **sample.js.template** - Template for testing the module
- **sample.js** - If this exists with your real API key, save it!
  - Contains tested locations (Starfront, Dunstable MA, Onset MA)
  - Has working API key: `40409ACC9E9B06535022056111DDA9F8A6D737D74F0963F402361626B7DECA4CC6778E63`

## OPTIONAL - Nice to Have

### Documentation
- **FONTS.md** - Font registration documentation
- **README.md** - Module documentation (if customized)
- **LICENSE** - License file

### Reference Images
- **sky-conditions.jpg** - Last generated image showing:
  - ✅ Data squares render correctly with proper colors
  - ✅ Gray midnight lines visible
  - ✅ Red current-time lines visible
  - ❌ NO text labels (demonstrates the font issue)

## DO NOT SAVE

### Corrupted Files
- ❌ **SkyConditionsImage.js** - Compiled JS with syntax errors
- ❌ **SkyConditionsImage.ts** (in root, not src/) - Corrupted
- ❌ **SkyConditionsImage.d.ts** - Type definitions from corrupted source
- ❌ **SkyConditionsImage.js.map** - Source map from corrupted compile
- ❌ **SkyConditionsImage.d.ts.map** - Type source map from corrupted compile

### Temporary/Generated Files
- ❌ All other `.js`, `.d.ts`, `.js.map` files in root (can be regenerated)
- ❌ **node_modules/** (can reinstall with `npm install`)
- ❌ **FONT-FIX.md** - Temporary workaround documentation
- ❌ **PROJECT-SUMMARY.md** - May be outdated

## Starting Over Checklist

1. ✅ Save Requirements file
2. ✅ Save all 4 clean src/*.ts files (types, Logger, AstrosphericAPI, index)
3. ✅ Save package.json and tsconfig.json
4. ✅ Save sample-config.json
5. ✅ Save .gitignore, .eslintrc.json, .prettierrc, .npmignore
6. 🔄 Create new project directory
7. 🔄 Copy saved files to new directory
8. 🔄 Run `npm install` to restore dependencies
9. 🔄 Rebuild src/SkyConditionsImage.ts using the font pattern from Requirements notes
10. 🔄 Test with `npm run build && node sample.js`

## Key Implementation Pattern for New SkyConditionsImage.ts

```typescript
// At the TOP of the file, BEFORE the class:
import * as PImage from "pureimage";
import * as fs from "fs";

// Module-level font loading
let registeredFont: any = null;
let registeredFontName = "Arial";

function loadSystemFont(): void {
    const fontOptions = [
        { path: "C:\\Windows\\Fonts\\arial.ttf", name: "Arial" },
        { path: "/System/Library/Fonts/Helvetica.ttc", name: "Helvetica" },
        { path: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", name: "DejaVu Sans" }
    ];

    for (const fontOption of fontOptions) {
        if (fs.existsSync(fontOption.path)) {
            try {
                registeredFont = PImage.registerFont(fontOption.path, fontOption.name);
                registeredFont.loadSync();
                registeredFontName = fontOption.name;
                console.log(`Font '${fontOption.name}' loaded successfully`);
                return;
            } catch (err) {
                console.error(`Failed to load font ${fontOption.name}:`, err);
            }
        }
    }
    console.warn("No system font found. Text labels will not appear.");
}

// Execute font loading immediately
loadSystemFont();

// Then define the class with drawing methods using:
// ctx.font = `24pt '${registeredFontName}'`;
```

This pattern is PROVEN to work based on the font test files.

## Data Visualization Code to Preserve

The following logic from the corrupted file works correctly and should be preserved:

1. **Color Methods** (working perfectly):
   - `getCloudCoverColor(cloudPercent: number): string`
   - `getSeeingColor(seeingValue: number): string`
   - `getWindSpeedColor(windMph: number): string`

2. **Data Extraction** (correct after fixes):
   ```typescript
   const cloudData = forecast.RDPS_CloudCover[hourIndex];
   const cloudPercent = cloudData?.Value?.ActualValue ?? null;
   
   const seeingData = forecast.RDPS_Seeing[hourIndex];
   const seeingValue = seeingData?.Value?.ActualValue ?? null;
   
   const windData = forecast.RDPS_WindSpeed10m[hourIndex];
   const windMs = windData?.Value?.ActualValue ?? null;
   const windMph = windMs !== null ? windMs * 2.237 : null;
   ```

3. **Layout Calculations** (proven to work):
   - Square positioning: `x = LEFT_MARGIN + i * SQUARE_WITH_BORDER`
   - Row positioning: `yOffset + subRowIndex * SUB_ROW_HEIGHT`
   - Midnight line detection: `(hourIndex % 24 === 0)`
   - Current time position calculation using moment-timezone

4. **Logging Pattern** (from weather-builder):
   - Log first 3 values: `Cloud: [0]=73, [1]=75, [2]=78`
   - Log coordinates, times, and positions
   - Use verbose level for detailed info
