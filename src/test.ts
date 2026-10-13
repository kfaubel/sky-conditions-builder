// Test runner for sky-conditions-builder (moved from project root sample.ts)
import fs from 'fs';
import { SkyConditionsImage, Logger } from './index';
import { Kache } from './Kache';
import { SimpleImageWriter } from './SimpleImageWriter';
import type { SkyConditionsConfig } from './types';

// Create a structured logger and helpers (Kache + SimpleImageWriter)
const logger = new Logger('sample', 'info');
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

    // Option: disable disk cache to force live API requests. Default: off.
    const noCache = process.argv.includes('--no-cache');
    const effectiveCacheDurationMinutes = noCache ? 0 : config.cacheDurationMinutes;
    const kache = noCache ? null : new Kache(logger, 'astrospheric-cache.json');

    if (noCache) {
        logger.info('Disk cache disabled (--no-cache): forcing live API requests');
    }

    const skyImage = new SkyConditionsImage(logger, writer, kache);

    try {
        logger.info('Fetching sky conditions data...');
        const result = await skyImage.getImage(config.title, config.apiKey, config.baseURL, effectiveCacheDurationMinutes, config.locations, config.outputFilename);

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
