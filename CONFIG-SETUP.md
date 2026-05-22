# Configuration Setup

## Quick Start

1. **Copy the sample config:**
   ```bash
   copy config.sample.json config.json
   ```

2. **Add your API key to `config.json`:**
   ```json
   {
       "apiKey": "YOUR_ACTUAL_ASTROSPHERIC_API_KEY_HERE",
       ...
   }
   ```

3. **Run the sample:**
   ```bash
   npm run build
   node sample.js
   ```

## Files Overview

### `config.json` (NOT in git)
Your actual configuration with the real API key. This file is in `.gitignore` to protect your credentials.

### `config.sample.json` (IN git)
A template configuration file that can be safely committed to git. Contains placeholder API key.

### `sample.ts` (IN git)
TypeScript example that loads configuration from `config.json`. Compiles to `sample.js`.

**Note:** The compiled `sample.js` is excluded from git via `.gitignore` (all `.js` files are excluded except mock-related ones).

## Configuration Options

```json
{
    "title": "Sky Conditions",
    "baseURL": "https://astrosphericpublicaccess.azurewebsites.net/api/",
    "apiKey": "YOUR_API_KEY_HERE",
    "cacheDurationMinutes": 1440,
    "outputFilename": "sky-conditions.jpg",
    "locations": [
        {
            "label": "Location Name",
            "latitude": 31.55,
            "longitude": -99.38,
            "timezone": "America/Chicago"
        }
    ]
}
```

### Parameters

- **`apiKey`** (required): Your Astrospheric API key
- **`title`** (optional): Title displayed at the top of the image
- **`baseURL`** (optional): Override the API base URL
- **`cacheDurationMinutes`** (optional): Cache API responses (in minutes, 0 = no cache)
- **`outputFilename`** (optional): Output filename (default: "sky-conditions.jpg")
- **`locations`** (required): Array of 1-3 locations to display

### Location Parameters

- **`label`**: Display name for the location
- **`latitude`**: Latitude in decimal degrees
- **`longitude`**: Longitude in decimal degrees
- **`timezone`**: IANA timezone identifier (e.g., "America/New_York")

## Development Modes

### Mode 1: Live API with Caching (Production)

Use when you have API credits available:

```bash
node sample.js
```

Set `cacheDurationMinutes: 1440` (24 hours) to minimize API usage.

### Mode 2: Mock Data (Development)

Use when API is rate-limited or during active development:

```bash
node sample-with-mocks.js
```

This uses pre-generated mock data files and doesn't consume API credits.

## Git Strategy

### Files COMMITTED to git:
✅ `config.sample.json` - Template configuration
✅ `sample.ts` - TypeScript source
✅ `sample-with-mocks.js` - Mock data script
✅ `generate-mock-data.js` - Mock data generator
✅ `mock-data-*.json` - Synthesized forecast data
✅ `.gitignore` - Excludes sensitive files

### Files NOT COMMITTED (in .gitignore):
❌ `config.json` - Your actual API key
❌ `sample.js` - Compiled JavaScript (can be regenerated)
❌ `*.jpg`, `*.png` - Generated images
❌ `node_modules/` - Dependencies

## Security Note

**Never commit `config.json`** - It contains your actual API key. The `.gitignore` is configured to exclude it. If you accidentally commit it:

1. Remove it from git history
2. Regenerate your API key at Astrospheric
3. Update your local `config.json` with the new key

## Sharing Your Project

When sharing this project:

1. ✅ Include `config.sample.json` so others can set up their own config
2. ✅ Include mock data files for development without API keys
3. ❌ Never share your `config.json` with the actual API key
4. 📝 Tell users to copy `config.sample.json` to `config.json` and add their own API key
