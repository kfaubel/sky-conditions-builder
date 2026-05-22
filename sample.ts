// Sample usage of sky-conditions-builder
import fs from 'fs';
import { SkyConditionsImage } from './src/index.js';
import type { SkyConditionsConfig } from './src/types.js';

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
