"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const axios_1 = __importDefault(require("axios"));
const AstrosphericAPI_1 = require("./AstrosphericAPI");
const logger = {
    info: () => undefined,
    verbose: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};
(0, node_test_1.default)('AstrosphericAPI normalizes the V2 forecast schema', async () => {
    const originalPost = axios_1.default.post;
    try {
        axios_1.default.post = async (url, body) => {
            strict_1.default.equal(url, 'https://v2-api-public.astrospheric.com/api/GetForecastData');
            strict_1.default.deepEqual(body.Variables, ['Cloud', 'Seeing', 'Transparency']);
            return {
                status: 200,
                data: {
                    TimeZone: 'UTC',
                    Latitude: 42.0,
                    Longitude: -71.0,
                    HourlyForecast: [{
                            UTCForecastHour: '2024-01-01T00:00:00Z',
                            HourOffset: 0,
                            Cloud: { ValueColor: '#123456', ActualValue: 12.5 },
                            Seeing: { ValueColor: '#654321', ActualValue: 1.2 },
                            Wind: { ValueColor: '#abcdef', ActualValue: 3.4 },
                            Temperature: { ValueColor: '#fedcba', ActualValue: 9.8 },
                            DewPoint: { ValueColor: '#ffffff', ActualValue: 2.1 },
                            WindDirection: { ValueColor: '#bbbbbb', ActualValue: 180 },
                            Transparency: { ValueColor: '#000000', ActualValue: 24 },
                        }],
                    APICreditCostOfCall: 15,
                }
            };
        };
        const api = new AstrosphericAPI_1.AstrosphericAPI(logger, 'test-key');
        const forecast = await api.getForecast(42, -71);
        strict_1.default.equal(forecast.UTCStartTime, '2024-01-01T00:00:00Z');
        strict_1.default.equal(forecast.RDPS_CloudCover?.[0]?.Value?.ActualValue, 12.5);
        strict_1.default.equal(forecast.Astrospheric_Seeing?.[0]?.Value?.ActualValue, 1.2);
        strict_1.default.equal(forecast.RDPS_WindVelocity?.[0]?.Value?.ActualValue, 24);
        strict_1.default.equal(forecast.Astrospheric_Transparency?.[0]?.Value?.ActualValue, 24);
        strict_1.default.equal(forecast.RDPS_Temperature?.[0]?.Value?.ActualValue, 9.8);
        strict_1.default.equal(forecast.APICreditUsedToday, 15);
    }
    finally {
        axios_1.default.post = originalPost;
    }
});
(0, node_test_1.default)('AstrosphericAPI logs API credit values and warns when credits are low', async () => {
    const originalPost = axios_1.default.post;
    const calls = [];
    const testLogger = {
        info: (message) => calls.push({ level: 'info', message }),
        verbose: () => undefined,
        warn: (message) => calls.push({ level: 'warn', message }),
        error: () => undefined,
    };
    try {
        axios_1.default.post = async () => ({
            status: 200,
            data: {
                TimeZone: 'UTC',
                Latitude: 42.0,
                Longitude: -71.0,
                HourlyForecast: [{
                        UTCForecastHour: '2024-01-01T00:00:00Z',
                        HourOffset: 0,
                        Cloud: { ValueColor: '#123456', ActualValue: 12.5 },
                    }],
                APICreditCostOfCall: 465,
                APICreditsRemaining: 9000,
            },
        });
        const api = new AstrosphericAPI_1.AstrosphericAPI(testLogger, 'test-key');
        await api.getForecast(42, -71);
        strict_1.default.ok(calls.some((entry) => entry.level === 'info' && entry.message.includes('APICreditCostOfCall=465')));
        strict_1.default.ok(calls.some((entry) => entry.level === 'info' && entry.message.includes('APICreditsRemaining=9000')));
        strict_1.default.ok(calls.some((entry) => entry.level === 'warn' && entry.message.includes('APICreditsRemaining=9000') && entry.message.includes('below 10000')));
    }
    finally {
        axios_1.default.post = originalPost;
    }
});
