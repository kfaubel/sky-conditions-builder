// Test runner for sky-conditions-builder (moved from project root sample.ts)
import fs from 'fs';
import { SkyConditionsImage, Logger } from './index';
import { AstrosphericAPI } from './AstrosphericAPI';
import { Kache } from './Kache';
import { SimpleImageWriter } from './SimpleImageWriter';
import type { SkyConditionsConfig, AstrosphericResponse } from './types';

// Create a structured logger and helpers (Kache + SimpleImageWriter)
const logger = new Logger('sample', 'info');
const kache = new Kache(logger, 'astrospheric-cache.json');
const writer = new SimpleImageWriter(logger, '.');

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

    // helper to extend arrays to REQUIRED_HOURS
    const REQUIRED_HOURS = 72; // match SkyConditionsImage.NUM_SQUARES
    const extendArray = <T,>(arr: T[] | undefined) => {
        if (!arr || arr.length === 0) return arr;
        const copy = arr.slice();
        while (copy.length < REQUIRED_HOURS) {
            // repeat last element (deep clone to be safe)
            const last = JSON.parse(JSON.stringify(copy[copy.length - 1]));
            copy.push(last);
        }
        return copy;
    };

    if (updateMocks) {
        const api = new AstrosphericAPI(logger, config.apiKey, config.baseURL, config.cacheDurationMinutes, kache);
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

                    if ((data as any).RDPS_CloudCover) (data as any).RDPS_CloudCover = extendArray((data as any).RDPS_CloudCover) as any;
                    if ((data as any).Astrospheric_Seeing) (data as any).Astrospheric_Seeing = extendArray((data as any).Astrospheric_Seeing) as any;
                    if ((data as any).RDPS_WindVelocity) (data as any).RDPS_WindVelocity = extendArray((data as any).RDPS_WindVelocity) as any;

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

    const skyImage = new SkyConditionsImage(logger, writer, kache);

    try {
        logger.info('Fetching sky conditions data...');
        const result = await skyImage.getImage(config.title, config.apiKey, config.baseURL, config.cacheDurationMinutes, config.locations, config.outputFilename);

        if (result !== null && result.jpegImg !== null) {
            // If an injected writer was used, it has already saved the image. Otherwise, write a fallback file.
            if (!writer) {
                fs.writeFileSync(config.outputFilename || 'sky-conditions.jpg', result.jpegImg.data);
                logger.info(`Sky conditions image created successfully! -> ${config.outputFilename || 'sky-conditions.jpg'}`);
            } else {
                logger.info('Sky conditions image created and saved via ImageWriter');
            }
        } else {
            logger.error("No jpegImg returned from getImageStream");
        }
    } catch (error) {
        logger.error(`Error: ${error}`);
    }
}

run();
