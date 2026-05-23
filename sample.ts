// Sample usage of sky-conditions-builder
import fs from 'fs';
import { SkyConditionsImage } from './src/index.js';
import { AstrosphericAPI } from './src/AstrosphericAPI.js';
import type { SkyConditionsConfig, AstrosphericResponse } from './src/types.js';

// Create a simple logger
const logger = {
    info: (...args: any[]) => console.log(...args),
    verbose: (...args: any[]) => {}, // Silent for verbose
    warn: (...args: any[]) => console.warn(...args),
    error: (...args: any[]) => console.error(...args)
};

async function run() {
    // Load configuration from external file
    const configPath = './config.json';
    
    if (!fs.existsSync(configPath)) {
        logger.error(`Configuration file not found: ${configPath}`);
        logger.error('Please copy config.sample.json to config.json and add your API key.');
        process.exit(1);
    }

    const config: SkyConditionsConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Option: update mock JSON files from live API. Default: off. Use --update-mocks to enable.
    const updateMocks = process.argv.includes('--update-mocks');

    if (updateMocks) {
        const api = new AstrosphericAPI(logger, config.apiKey, config.baseURL, config.cacheDurationMinutes);
        for (const loc of config.locations) {
            try {
                logger.info(`Fetching live forecast for ${loc.label} (${loc.latitude}, ${loc.longitude}) to update mock...`);
                const data = await api.getForecast(loc.latitude, loc.longitude) as AstrosphericResponse;
                const safeName = loc.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                const filename = `mock-data-${safeName}.json`;
                fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
                logger.info(`Updated mock data to ${filename}`);
            } catch (err) {
                logger.error(`Failed to fetch/update mock for ${loc.label}: ${err}`);
            }
        }
    } else {
        logger.info('Not updating mock files (use --update-mocks to refresh)');
    }

    // Monkey-patch AstrosphericAPI.getForecast to return mock files when available, falling back to live API.
    const originalGetForecast = AstrosphericAPI.prototype.getForecast;
    AstrosphericAPI.prototype.getForecast = async function(this: any, latitude: number, longitude: number) {
        // Attempt to find a mock file by matching coordinates to known mock filenames
        // Build candidate filename by searching config locations list for matching coords
        const loc = config.locations.find(l => l.latitude.toFixed(2) === latitude.toFixed(2) && l.longitude.toFixed(2) === longitude.toFixed(2));
        if (loc) {
            const safeName = loc.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const filename = `mock-data-${safeName}.json`;
            if (fs.existsSync(filename)) {
                try {
                    logger.info(`[Mock] Loading data from ${filename}`);
                    const data = JSON.parse(fs.readFileSync(filename, 'utf8')) as AstrosphericResponse;
                    return data;
                } catch (err) {
                    logger.error(`[Mock] Failed to load mock ${filename}: ${err}`);
                    // fall through to live
                }
            }
        }
        // No mock found or failed to read — fall back to original implementation
        return originalGetForecast.apply(this, [latitude, longitude]);
    };

    const skyImage = new SkyConditionsImage(logger);

    try {
        logger.info('Fetching sky conditions data...');
        const result = await skyImage.getImageStream(config);

        if (result !== null && result.jpegImg !== null) {
            fs.writeFileSync('sky-conditions.jpg', result.jpegImg.data);
            logger.info('Sky conditions image created successfully! -> sky-conditions.jpg');
        } else {
            logger.error("No jpegImg returned from getImageStream");
        }
    } catch (error) {
        logger.error(`Error: ${error}`);
    }
}

run();
