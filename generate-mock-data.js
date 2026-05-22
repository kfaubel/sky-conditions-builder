// Generate mock data files for all locations
const fs = require('fs');

function generateMockData(location) {
    const baseTime = "2026-05-22T06:00:00Z";
    const localStartTime = "2026-05-22T01:00:00";
    
    const data = {
        TimeZone: location.timezone,
        UTCMinuteOffset: location.utcOffset,
        ModelTime: baseTime,
        Latitude: location.latitude,
        Longitude: location.longitude,
        LocalStartTime: localStartTime,
        UTCStartTime: baseTime,
        APICreditUsedToday: 0,
        RDPS_CloudCover: [],
        Astrospheric_Seeing: [],
        RDPS_WindVelocity: []
    };

    // Generate 81 hours of data
    for (let hour = 0; hour < 81; hour++) {
        // Cloud cover - varies by location characteristics
        let cloudBase = location.cloudBase || 20;
        let cloudVariation = location.cloudVariation || 20;
        let hourInDay = hour % 24;
        
        // More clouds during day (hours 6-18)
        let cloudValue;
        if (hourInDay >= 6 && hourInDay <= 18) {
            cloudValue = cloudBase + cloudVariation + Math.sin(hour * 0.3) * 15;
        } else {
            cloudValue = cloudBase + Math.sin(hour * 0.2) * 10;
        }
        cloudValue = Math.max(0, Math.min(100, cloudValue));
        
        data.RDPS_CloudCover.push({
            Value: { ActualValue: cloudValue, ValueColor: getCloudColor(cloudValue) },
            HourOffset: hour
        });

        // Seeing - better at night
        let seeingValue;
        if (hourInDay >= 0 && hourInDay <= 6 || hourInDay >= 20) {
            // Night - good seeing
            seeingValue = 0.3 + Math.random() * 0.8;
        } else {
            // Day - poor seeing
            seeingValue = 2.0 + Math.random() * 2.0;
        }
        seeingValue += location.seeingOffset || 0;
        
        data.Astrospheric_Seeing.push({
            Value: { ActualValue: seeingValue, ValueColor: getSeeingColor(seeingValue) },
            HourOffset: hour
        });

        // Wind speed - varies by location
        let windBase = location.windBase || 3;
        let windVariation = location.windVariation || 2;
        let windValue;
        
        if (hourInDay >= 10 && hourInDay <= 16) {
            // Daytime - more wind
            windValue = windBase + windVariation + Math.random() * 2;
        } else {
            // Night - calmer
            windValue = windBase + Math.random() * windVariation;
        }
        
        data.RDPS_WindVelocity.push({
            Value: { ActualValue: windValue, ValueColor: getWindColor(windValue) },
            HourOffset: hour
        });
    }

    return data;
}

function getCloudColor(cloudPercent) {
    if (cloudPercent <= 0) return "#00008B";
    if (cloudPercent <= 10) return "#0000CD";
    if (cloudPercent <= 20) return "#0000FF";
    if (cloudPercent <= 50) return "#4169E1";
    if (cloudPercent <= 80) return "#87CEEB";
    return "#FFFFFF";
}

function getSeeingColor(seeingValue) {
    if (seeingValue <= 0) return "#FFFFFF";
    if (seeingValue <= 1) return "#87CEEB";
    if (seeingValue <= 2) return "#0000FF";
    if (seeingValue <= 3) return "#0000CD";
    return "#00008B";
}

function getWindColor(windMs) {
    const windMph = windMs * 2.237;
    if (windMph <= 5) return "#00008B";
    if (windMph <= 10) return "#0000CD";
    if (windMph <= 15) return "#0000FF";
    if (windMph <= 20) return "#87CEEB";
    return "#FFFFFF";
}

// Location profiles
const locations = [
    {
        name: "starfront",
        latitude: 31.55,
        longitude: -99.38,
        timezone: "America/Chicago",
        utcOffset: -300,
        cloudBase: 10,
        cloudVariation: 15,
        windBase: 2,
        windVariation: 2,
        seeingOffset: 0
    },
    {
        name: "dunstable",
        latitude: 42.68,
        longitude: -71.47,
        timezone: "America/New_York",
        utcOffset: -240,
        cloudBase: 35,
        cloudVariation: 25,
        windBase: 3.5,
        windVariation: 2.5,
        seeingOffset: 0.5
    },
    {
        name: "onset",
        latitude: 41.75,
        longitude: -71.25,
        timezone: "America/New_York",
        utcOffset: -240,
        cloudBase: 45,
        cloudVariation: 30,
        windBase: 5,
        windVariation: 3,
        seeingOffset: 1.0
    }
];

// Generate files
for (const location of locations) {
    const data = generateMockData(location);
    const filename = `mock-data-${location.name}.json`;
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`✅ Created ${filename}`);
}

console.log('\n📝 Mock data files ready for development!');
console.log('   - Starfront: Good dark sky site, low clouds, calm winds');
console.log('   - Dunstable: More variable, moderate clouds and wind');
console.log('   - Onset: Coastal location, higher clouds and wind');
