// Sample usage with local mock data files
const fs = require('fs');
const { SkyConditionsImage } = require('./index.js');

// Mock the API to use local JSON files
const AstrosphericAPI = require('./AstrosphericAPI').AstrosphericAPI;
const mockDataFiles = {
    '31.55,-99.38': './mock-data-starfront.json',
    '42.68,-71.47': './mock-data-dunstable.json', 
    '41.75,-71.25': './mock-data-onset.json'
};

const originalGetForecast = AstrosphericAPI.prototype.getForecast;
AstrosphericAPI.prototype.getForecast = async function(lat, lon) {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const filePath = mockDataFiles[key];
    
    if (filePath && fs.existsSync(filePath)) {
        console.log(`[Mock] Loading data from ${filePath}`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return data;
    } else {
        console.log(`[Mock] No mock data for ${key}, falling back to real API`);
        return originalGetForecast.call(this, lat, lon);
    }
};

// Create a simple logger
const logger = {
    info: (...args) => console.log(...args),
    verbose: (...args) => {}, // Silent for verbose
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

async function run() {
    const config = {
        "title": "Sky Conditions",
        "baseURL": "https://astrosphericpublicaccess.azurewebsites.net/api/",
        "apiKey": "40409ACC9E9B06535022056111DDA9F8A6D737D74F0963F402361626B7DECA4CC6778E63",
        "cacheDurationMinutes": 60*24,
        "outputFilename": "sky-conditions.jpg",
        "locations": [
            { "label": "Starfront", "latitude": 31.55, "longitude": -99.38, "timezone": "America/Chicago" },
            { "label": "Dunstable, MA", "latitude": 42.68, "longitude": -71.47, "timezone": "America/New_York" },
            { "label": "Onset, MA", "latitude": 41.75, "longitude": -71.25, "timezone": "America/New_York" }
        ]
    }

    const skyImage = new SkyConditionsImage(logger);

    try {
        logger.info('Generating sky conditions with mock data...');
        const result = await skyImage.getImageStream(config);

        if (result !== null && result.jpegImg !== null) {
            fs.writeFileSync('sky-conditions.jpg', result.jpegImg.data);
            logger.info('✅ Sky conditions image created successfully! -> sky-conditions.jpg');
        } else {
            logger.error("No jpegImg returned from getImageStream");
        }
    } catch (error) {
        logger.error(`Error: ${error}`);
        console.error(error.stack);
    }
}

run();
