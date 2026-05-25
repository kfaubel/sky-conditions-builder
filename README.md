# Sky Conditions Builder

This tool generates a compact sky conditions image and per-location CSV forecast exports using Astrospheric forecast data. It supports dependency injection for logging, caching, and image writing so you can swap implementations for testing or production.

Key points

- The generator always shows a 72-hour timeline aligned to the earliest local midnight across configured locations.
- Forecast CSV files are generated per-location and are now written via the injected ImageWriter (if provided). Fallback to disk is used if no writer is injected.
- The project uses a pluggable on-disk cache implementation (`Kache`) compatible with the weather-builder project.

## Features

- Displays 72-hour (3-day) forecast in 2-hour intervals
- Shows three key metrics for astrophotography:
  - **Sky Cover**: Cloud cover percentage
  - **Atmospheric Seeing**: Sky stability/turbulence
  - **Wind Speed**: Wind velocity
- Color-coded squares for easy visual interpretation
- Timezone-aware current time indicators
- Supports up to 3 locations with separate rows
- Uses [Astrospheric API](https://www.astrospheric.com/DynamicContent/api_info.html) for professional-grade astronomy weather data

## Installation

```bash
npm install sky-conditions-builder
```

## Configuration

For development/testing with this repository:

1. **Copy the sample config:**
   ```bash
   cp config.sample.json config.json
   ```

2. **Add your API key to `config.json`:**
   ```json
   {
       "apiKey": "YOUR_ASTROSPHERIC_API_KEY_HERE",
       ...
   }
   ```

3. **Build and run:**
   ```bash
   npm run build
   node sample.js
   ```

See [CONFIG-SETUP.md](CONFIG-SETUP.md) for detailed configuration documentation.

## Requirements

- Node.js >= 18.0.0
- Valid Astrospheric API key (requires [Astrospheric Professional membership](https://www.astrospheric.com/dynamiccontent/subscription.html))

## Usage

```typescript
import fs from 'fs';
import { SkyConditionsImage } from 'sky-conditions-builder';

// Create a logger (can be part of a bigger package)
const logger = {
    info: (...args) => console.log(...args),
    verbose: (...args) => console.debug(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

async function run() {
    const config = {
        apiKey: "your_api_key_here",
        title: "Sky Conditions",  // Optional: custom title for the image
        baseURL: "https://astrosphericpublicaccess.azurewebsites.net/api/", // Optional: override API base URL
        outputFilename: "sky-conditions.jpg", // Optional: specify output filename
        cacheDurationMinutes: 1440, // Optional: cache API responses (in minutes, e.g., 1440 = 24 hours)
        locations: [
            {
                label: "Onset, MA",
                latitude: 41.75,
                longitude: -70.644,
                timezone: "America/New_York"
            },
            {
                label: "Flagstaff, AZ",
                latitude: 35.1983,
                longitude: -111.6513,
                timezone: "America/Phoenix"
            },
            {
                label: "Mauna Kea, HI",
                latitude: 19.8207,
                longitude: -155.4681,
                timezone: "Pacific/Honolulu"
            }
        ]
    };

    const skyImage = new SkyConditionsImage(logger);

    try {
        const result = await skyImage.getImageStream(config);

        if (result !== null && result.jpegImg !== null) {
            fs.writeFileSync('sky-conditions.jpg', result.jpegImg.data);
            logger.info('Sky conditions image created successfully!');
        } else {
            logger.error("No jpegImg returned from getImageStream");
        }
    } catch (error) {
        logger.error(`Error: ${error}`);
    }
}

run();
```

## Configuration

### Config Object

```typescript
interface Config {
    apiKey: string;         // Your Astrospheric API key
    baseURL?: string;       // Optional: API base URL (default: https://astrosphericpublicaccess.azurewebsites.net/api/)
    outputFilename?: string; // Optional: output filename (for documentation purposes)
    locations: Location[];  // Array of 1-3 locations
}

interface Location {
    label: string;      // Display name (e.g., "Onset, MA")
    latitude: number;   // Latitude in decimal degrees
    longitude: number;  // Longitude in decimal degrees
    timezone: string;   // IANA timezone (e.g., "America/New_York")
}
```

### Color Coding

**Sky Cover (Cloud Cover):**
- Very Dark Blue: 0% (clear skies)
- Medium Dark Blue: 0-10%
- Medium Blue: 10-20%
- Light Blue: 20-50%
- Very Light Blue: 50-80%
- White: 80%+ (heavy clouds)

**Atmospheric Seeing:**
- White: Cloudy
- Light Blue: Poor
- Medium Blue: Below Average
- Medium Dark Blue: Average
- Very Dark Blue: Above Average/Excellent

**Wind Speed:**
- Very Dark Blue: 0-5 mph (calm)
- Medium Dark Blue: 5-10 mph
- Medium Blue: 10-15 mph
- Light Blue: 15-20 mph
- White: 20+ mph (windy)

## Output

The module generates a 1920x1080 JPEG image with:
- Dark gray (#333333) background
- 40x40 pixel colored squares with 2-pixel borders
- Time labels every 12 hours (12AM/12PM)
- Red vertical line showing current time for each location (timezone-aware)
- Location labels and data type labels

## Error Handling

The module will throw an error if:
- API key is missing or invalid
- No locations are provided
- Astrospheric API request fails
- Network connectivity issues occur

If fewer than 3 locations are provided, remaining rows are left blank. If more than 3 locations are provided, only the first 3 are used.

## API Credits

The Astrospheric API provides 100 credits per day for Pro members. Each forecast request costs 5 credits. This module makes one request per location, so fetching data for 3 locations uses 15 credits.

Forecast data is updated every 6 hours by Astrospheric. 

## API Response Caching

The module supports optional response caching to reduce API usage:

```typescript
const config = {
    apiKey: "your-key",
    cacheDurationMinutes: 1440,  // Cache responses for 24 hours
    locations: [...]
};
```

- **When enabled**: API responses are cached via the configured `Kache` implementation
- **When to use**: During development or when generating images frequently
- **Benefits**: Reduces API credit consumption, faster generation, avoids rate limits
- **Cache lifetime**: Specified in minutes (e.g., 1440 = 24 hours)
- **Disable caching**: Set to `0` or omit the parameter

## Development with Mock Data

When API rate limits are reached, use pre-generated mock data:

```bash
# Use mock data instead of live API
node sample-with-mocks.js

# Regenerate mock data files
node generate-mock-data.js
```

See [MOCK-DATA-README.md](MOCK-DATA-README.md) for complete documentation on mock data development workflow.

## Publishing to NPM

To publish this package to the NPM registry, follow these steps:

1. **Ensure you are logged in to NPM:**
   ```bash
   npm login
   ```
2. **Build the project:** Make sure the latest TypeScript code is compiled.
   ```bash
   npm run build
   ```
3. **Update the version:** Increment the package version (e.g., patch, minor, or major).
   ```bash
   npm version patch
   ```
4. **Publish the package:**
   ```bash
   npm publish
   ```

## License

MIT

## Author

Ken Faubel

## Related Modules

- [weather-builder](https://github.com/kfaubel/weather-builder) - NWS weather forecast images

## Support

For issues with the module, please open an issue on GitHub.

For Astrospheric API questions, contact [developer@astrospheric.com](mailto:developer@astrospheric.com).
