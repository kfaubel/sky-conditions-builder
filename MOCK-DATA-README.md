# Mock Data for Development

## Overview

This directory contains mock astronomy forecast data for development when the Astrospheric API rate limit has been reached.

## Files

- **mock-data-starfront.json** - Starfront Observatory, TX (31.55°N, -99.38°W)
  - Good dark sky site characteristics
  - Low cloud cover (mostly clear nights)
  - Calm winds (1-6 m/s)
  - Excellent seeing at night

- **mock-data-dunstable.json** - Dunstable, MA (42.68°N, -71.47°W)
  - More variable conditions
  - Moderate cloud cover (35-60%)
  - Moderate winds (3-6 m/s)
  - Fair to good seeing

- **mock-data-onset.json** - Onset, MA (41.75°N, -71.25°W)
  - Coastal location characteristics
  - Higher cloud cover (45-75%)
  - Windier conditions (5-8 m/s)
  - More challenging seeing conditions

## Usage

### Using sample-with-mocks.js

The simplest way to use mock data:

```bash
node sample-with-mocks.js
```

This script automatically loads local JSON files instead of calling the API.

### Regenerating Mock Data

If you need to create new mock data with different characteristics:

```bash
node generate-mock-data.js
```

Edit the `locations` array in `generate-mock-data.js` to adjust:
- `cloudBase` - Base cloud cover percentage
- `cloudVariation` - How much clouds vary
- `windBase` - Base wind speed in m/s
- `windVariation` - How much wind varies
- `seeingOffset` - Offset for seeing values (higher = worse)

## Cache Configuration

The `cacheDurationMinutes` config parameter enables API response caching:

```javascript
const config = {
    "apiKey": "your-key",
    "cacheDurationMinutes": 1440,  // 24 hours
    "locations": [...]
};
```

- When set to 0 or omitted: No caching (always fetch from API)
- When set > 0: Cache responses for the specified duration
- Cache key: Based on latitude/longitude (rounded to 2 decimals)
- Cache location: In-memory (cleared when process restarts)

### Benefits of Caching

1. **Reduce API costs** - Astrospheric charges 5 credits per location per call
2. **Faster development** - Avoid waiting for API responses during testing
3. **Rate limit protection** - Prevent hitting API limits during development
4. **Consistent testing** - Same data across multiple runs

### Cache Behavior

- First call for a location: Fetches from API and caches
- Subsequent calls within cache duration: Returns cached data
- After cache expires: Fetches fresh data from API
- Logging shows cache hits: "Using cached forecast for 31.55,-99.38 (age: 5 minutes)"

## Development Workflow

### When API is Available

```javascript
// sample.js
const config = {
    "apiKey": "your-api-key",
    "cacheDurationMinutes": 1440,  // Cache for 24 hours
    "locations": [...]
};
```

Run: `node sample.js`

### When API Rate Limit is Reached

Run: `node sample-with-mocks.js`

This bypasses the API entirely and uses local JSON files.

## Data Format

Each mock data file contains:

- 81 hours of forecast data (3+ days)
- Three data arrays:
  - `RDPS_CloudCover` - Cloud cover percentage (0-100%)
  - `Astrospheric_Seeing` - Atmospheric seeing (0-5, lower is better)
  - `RDPS_WindVelocity` - Wind speed in meters per second

Each hour has:
```json
{
  "Value": {
    "ActualValue": 15.2,
    "ValueColor": "#0000CD"
  },
  "HourOffset": 0
}
```

## Tips

1. **Testing layout changes**: Use mock data to iterate quickly without API calls
2. **Testing error handling**: Modify mock files to test edge cases
3. **Different conditions**: Edit mock files to test various weather scenarios
4. **New locations**: Copy and modify an existing mock file for new coordinates
