# Sky Conditions Builder - Project Summary

## Project Structure

```
sky-conditions-builder/
├── src/
│   ├── index.ts                  # Main exports
│   ├── SkyConditionsImage.ts     # Core image generation class
│   ├── AstrosphericAPI.ts        # API client for Astrospheric
│   ├── types.ts                  # TypeScript interfaces
│   └── Logger.ts                 # Logger interface
├── index.js                      # Compiled entry point
├── index.d.ts                    # Type definitions
├── package.json                  # NPM configuration
├── tsconfig.json                 # TypeScript configuration
├── sample.js                     # Example usage
├── sample-config.json            # Example configuration
├── README.md                     # Documentation
└── LICENSE                       # MIT License
```

## Features Implemented

✅ **NPM Module Structure**
   - TypeScript with CommonJS output
   - Similar interface to weather-builder
   - Proper type definitions included

✅ **Image Generation**
   - 1920x1080 JPEG output
   - Dark gray (#333333) background
   - 3 location rows (handles 1-3 locations)

✅ **Data Display**
   - 72-hour forecast (3 days)
   - 2-hour interval squares (36 per row)
   - 40x40 pixel squares with 2px borders
   - 3 data types per location:
     * Sky Cover (cloud coverage)
     * Atmospheric Seeing
     * Wind Speed

✅ **Color Coding**
   - Sky Cover: Very dark blue (clear) → White (>80% clouds)
   - Seeing: White (cloudy) → Very dark blue (excellent)
   - Wind: Very dark blue (0-5 mph) → White (>20 mph)

✅ **Time Features**
   - X-axis labels every 12 hours (12AM/12PM format)
   - Timezone-aware red line for current time
   - Each location uses its own timezone

✅ **API Integration**
   - Astrospheric GetForecastData_V1 endpoint
   - Proper error handling (throws on failure)
   - 30-second timeout
   - API credit tracking

✅ **Configuration**
   - JSON config with apiKey and locations array
   - Location includes: Label, Latitude, Longitude, Timezone
   - Outputs to sky-conditions.jpg in current directory

## Usage Example

```javascript
const { SkyConditionsImage } = require('sky-conditions-builder');

const logger = {
    info: (...args) => console.log(...args),
    verbose: (...args) => console.debug(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

const config = {
    apiKey: "your_api_key_here",
    locations: [
        {
            label: "Onset, MA",
            latitude: 41.75,
            longitude: -70.644,
            timezone: "America/New_York"
        }
    ]
};

const skyImage = new SkyConditionsImage(logger);
const result = await skyImage.getImageStream(config);

if (result && result.jpegImg) {
    fs.writeFileSync('sky-conditions.jpg', result.jpegImg.data);
}
```

## Dependencies

- **pureimage**: Canvas drawing (no native dependencies)
- **axios**: HTTP requests to Astrospheric API
- **moment-timezone**: Timezone handling for current time lines

## Testing

To test the module:

1. Get an Astrospheric API key from https://www.astrospheric.com
2. Update sample.js or sample-config.json with your API key
3. Run: `node sample.js`
4. Check sky-conditions.jpg

## Color Scale Details

**Sky Cover (RDPS_CloudCover):**
- 0%: #00008B (very dark blue)
- 0-10%: #0000CD (medium dark blue)
- 10-20%: #0000FF (medium blue)
- 20-50%: #4169E1 (light blue)
- 50-80%: #87CEEB (very light blue)
- 80%+: #FFFFFF (white)

**Atmospheric Seeing (Astrospheric_Seeing):**
- 0 (Cloudy): #FFFFFF (white)
- 1 (Poor): #87CEEB (light blue)
- 2 (Below Average): #0000FF (medium blue)
- 3 (Average): #0000CD (medium dark blue)
- 4-5 (Above Average/Excellent): #00008B (very dark blue)

**Wind Speed (RDPS_WindVelocity):**
- 0-5 mph: #00008B (very dark blue)
- 5-10 mph: #0000CD (medium dark blue)
- 10-15 mph: #0000FF (medium blue)
- 15-20 mph: #87CEEB (light blue)
- 20+ mph: #FFFFFF (white)

## Layout Parameters (Configurable)

Located at the top of SkyConditionsImage.ts for easy adjustment:
- IMAGE_WIDTH: 1920
- IMAGE_HEIGHT: 1080
- SQUARE_SIZE: 40
- SQUARE_BORDER: 2
- LEFT_MARGIN: 150 (for location labels)
- TOP_MARGIN: 60 (for time labels)
- LOCATION_ROW_HEIGHT: 280
- SUB_ROW_HEIGHT: 60

## Future Enhancements (Not Implemented)

- Caching (not needed for hourly updates)
- Legend display (user requested no legend)
- 6-hour time labels (currently 12-hour, easy to change)

## Status

✅ **Project Complete**
- All requirements implemented
- TypeScript compiled successfully
- Ready for NPM publishing
- Comprehensive documentation included
