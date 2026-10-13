"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstrosphericAPI = void 0;
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const moment = __importStar(require("moment-timezone"));
class AstrosphericAPI {
    logger;
    apiKey;
    endpoint;
    // Optional disk-backed cache (Kache)
    kache;
    imageWriter;
    cacheDurationMs;
    constructor(logger, apiKey, baseURL, cacheDurationMinutes, kache, imageWriter) {
        this.logger = logger;
        this.apiKey = apiKey;
        const base = (baseURL || "https://v2-api-public.astrospheric.com/api/").replace(/\/+$/, "");
        const normalizedBase = base.endsWith("/GetForecastData") || base.endsWith("/GetForecastData_V1")
            ? base.replace(/\/GetForecastData(?:_V1)?$/, "")
            : base;
        this.endpoint = `${normalizedBase}/GetForecastData`;
        this.kache = kache ?? null;
        this.imageWriter = imageWriter ?? null;
        this.cacheDurationMs = (cacheDurationMinutes || 0) * 60 * 1000;
        this.logger.info(`Astrospheric API endpoint: ${this.endpoint}`);
        if (cacheDurationMinutes && cacheDurationMinutes > 0) {
            this.logger.info(`Cache enabled: ${cacheDurationMinutes} minutes`);
        }
    }
    logApiCreditStatus(response, context) {
        const costOfCall = response.APICreditCostOfCall ?? response.APICreditUsedToday ?? 'unknown';
        const creditsRemaining = response.APICreditsRemaining ?? response.APICreditsRemainingToday ?? 'unknown';
        const message = `Astrospheric API credit status for ${context}: APICreditCostOfCall=${costOfCall}, APICreditsRemaining=${creditsRemaining}`;
        if (typeof creditsRemaining === 'number' && creditsRemaining < 10000) {
            this.logger.warn(`${message}. Credits below 10000`);
        }
        this.logger.info(message);
    }
    normalizeForecastResponse(data) {
        const normalized = { ...data };
        const convertMetricValue = (value, hourOffset, utcForecastHour) => {
            if (!value || typeof value !== 'object')
                return null;
            const actualValue = typeof value.ActualValue === 'number' ? value.ActualValue : Number(value.ActualValue ?? NaN);
            if (Number.isNaN(actualValue))
                return null;
            return {
                Value: {
                    ValueColor: value.ValueColor ?? '#000000',
                    ActualValue: actualValue,
                },
                HourOffset: hourOffset,
                UTCForecastHour: utcForecastHour,
            };
        };
        const hourlyForecast = Array.isArray(normalized.HourlyForecast) ? normalized.HourlyForecast : [];
        if (hourlyForecast.length > 0) {
            const cloudSeries = hourlyForecast
                .map((entry, index) => convertMetricValue(entry.Cloud, entry.HourOffset ?? index, entry.UTCForecastHour))
                .filter((value) => value !== null);
            const seeingSeries = hourlyForecast
                .map((entry, index) => convertMetricValue(entry.Seeing, entry.HourOffset ?? index, entry.UTCForecastHour))
                .filter((value) => value !== null);
            const transparencySeries = hourlyForecast
                .map((entry, index) => convertMetricValue(entry.Transparency, entry.HourOffset ?? index, entry.UTCForecastHour))
                .filter((value) => value !== null);
            const temperatureSeries = hourlyForecast
                .map((entry, index) => convertMetricValue(entry.Temperature, entry.HourOffset ?? index, entry.UTCForecastHour))
                .filter((value) => value !== null);
            const dewPointSeries = hourlyForecast
                .map((entry, index) => convertMetricValue(entry.DewPoint, entry.HourOffset ?? index, entry.UTCForecastHour))
                .filter((value) => value !== null);
            const windDirectionSeries = hourlyForecast
                .map((entry, index) => convertMetricValue(entry.WindDirection, entry.HourOffset ?? index, entry.UTCForecastHour))
                .filter((value) => value !== null);
            normalized.UTCStartTime ??= hourlyForecast[0]?.UTCForecastHour;
            normalized.RDPS_CloudCover ??= cloudSeries;
            normalized.Astrospheric_Seeing ??= seeingSeries;
            normalized.RDPS_WindVelocity ??= transparencySeries;
            normalized.RDPS_Temperature ??= temperatureSeries;
            normalized.RDPS_DewPoint ??= dewPointSeries;
            normalized.RDPS_WindDirection ??= windDirectionSeries;
            normalized.Astrospheric_Transparency ??= transparencySeries;
        }
        if (normalized.RDPS_CloudCover === undefined && Array.isArray(normalized.Cloud)) {
            normalized.RDPS_CloudCover = normalized.Cloud;
        }
        if (normalized.Astrospheric_Seeing === undefined && Array.isArray(normalized.Seeing)) {
            normalized.Astrospheric_Seeing = normalized.Seeing;
        }
        if (normalized.RDPS_WindVelocity === undefined && Array.isArray(normalized.Transparency)) {
            normalized.RDPS_WindVelocity = normalized.Transparency;
        }
        if (normalized.RDPS_Temperature === undefined && Array.isArray(normalized.Temperature)) {
            normalized.RDPS_Temperature = normalized.Temperature;
        }
        if (normalized.RDPS_DewPoint === undefined && Array.isArray(normalized.DewPoint)) {
            normalized.RDPS_DewPoint = normalized.DewPoint;
        }
        if (normalized.RDPS_WindDirection === undefined && Array.isArray(normalized.WindDirection)) {
            normalized.RDPS_WindDirection = normalized.WindDirection;
        }
        if (normalized.Astrospheric_Transparency === undefined && Array.isArray(normalized.Transparency)) {
            normalized.Astrospheric_Transparency = normalized.Transparency;
        }
        if (!normalized.UTCStartTime) {
            const series = [
                normalized.RDPS_CloudCover,
                normalized.Astrospheric_Seeing,
                normalized.RDPS_WindVelocity,
                normalized.RDPS_Temperature,
                normalized.RDPS_DewPoint,
                normalized.RDPS_WindDirection,
                normalized.Astrospheric_Transparency,
            ].filter((value) => Array.isArray(value));
            let earliestUTC;
            for (const entries of series) {
                for (const entry of entries) {
                    const forecastHour = entry.UTCForecastHour;
                    if (!forecastHour)
                        continue;
                    if (!earliestUTC || forecastHour < earliestUTC) {
                        earliestUTC = forecastHour;
                    }
                }
            }
            if (earliestUTC) {
                normalized.UTCStartTime = earliestUTC;
            }
        }
        if (normalized.APICreditUsedToday === undefined && normalized.APICreditCostOfCall !== undefined) {
            normalized.APICreditUsedToday = normalized.APICreditCostOfCall;
        }
        return normalized;
    }
    // Write a CSV file containing UTC/local timestamps and the primary forecast values for
    // cloud cover, seeing and wind speed. Filename is derived from the location label when provided.
    writeForecastCSV(cacheKey, data, locationLabel) {
        try {
            const safeKey = cacheKey.replace(/[^0-9a-zA-Z._-]/g, '_');
            const safeLabel = (locationLabel || '').trim().replace(/[^0-9a-zA-Z._-]/g, '_');
            const fileStem = safeLabel || safeKey;
            const filename = `forecast-${fileStem}.csv`;
            const startUTC = moment.tz(data.UTCStartTime, 'UTC');
            const tz = data.TimeZone || 'UTC';
            const cloud = data.RDPS_CloudCover || [];
            const seeing = data.Astrospheric_Seeing || [];
            const wind = data.RDPS_WindVelocity || [];
            const maxLen = Math.max(cloud.length, seeing.length, wind.length);
            const lines = [];
            lines.push('UTC_Date,UTC_Time,Local_Date,Local_Time,CloudPercent,SeeingValue,Wind_m_s,Source');
            const source = data._source || '';
            for (let i = 0; i < maxLen; i++) {
                const t = startUTC.clone().add(i, 'hours');
                const local = t.clone().tz(tz);
                const cloudRaw = cloud[i]?.Value?.ActualValue;
                const cloudVal = typeof cloudRaw === 'number'
                    ? Math.min(100, Math.max(1, Math.round(cloudRaw)))
                    : '';
                const seeingVal = seeing[i]?.Value?.ActualValue ?? '';
                const windVal = wind[i]?.Value?.ActualValue ?? '';
                const utcDate = t.format('YYYY-MM-DD');
                const utcTime = t.format('HH:mm');
                const localDate = local.format('YYYY-MM-DD');
                const localTime = local.format('HH:mm');
                lines.push(`${utcDate},${utcTime},${localDate},${localTime},${cloudVal},${seeingVal},${windVal},${source}`);
            }
            const content = lines.join('\n');
            if (this.imageWriter) {
                try {
                    this.imageWriter.saveFile(filename, Buffer.from(content, 'utf8'));
                    this.logger.verbose(`Wrote forecast CSV via ImageWriter: ${filename}`);
                }
                catch (e) {
                    this.logger.error(`ImageWriter failed to write CSV ${filename}: ${e}`);
                    fs.writeFileSync(filename, content, 'utf8');
                    this.logger.verbose(`Wrote forecast CSV fallback: ${filename}`);
                }
            }
            else {
                fs.writeFileSync(filename, content, 'utf8');
                this.logger.verbose(`Wrote forecast CSV: ${filename}`);
            }
        }
        catch (err) {
            this.logger.error(`Failed to write forecast CSV for ${cacheKey}: ${err}`);
        }
    }
    async getForecast(latitude, longitude, locationLabel) {
        // Check cache first
        // Use higher precision so nearby locations do not collapse to the same key/filename.
        const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
        // If a disk-backed Kache is provided, consult it first
        if (this.kache) {
            try {
                const cached = this.kache.get(cacheKey);
                if (cached) {
                    const normalizedCached = this.normalizeForecastResponse(cached);
                    const hasForecastData = !!(normalizedCached.RDPS_CloudCover?.length ||
                        normalizedCached.Astrospheric_Seeing?.length ||
                        normalizedCached.RDPS_WindVelocity?.length);
                    if (hasForecastData) {
                        if (normalizedCached._source === undefined)
                            normalizedCached._source = 'cached';
                        this.writeForecastCSV(cacheKey, normalizedCached, locationLabel);
                        this.logger.info(`Using cached value from Kache for sky conditions ${cacheKey}`);
                        return normalizedCached;
                    }
                    this.logger.warn(`Cached forecast for ${cacheKey} was missing forecast arrays; fetching a fresh value from the API.`);
                }
            }
            catch (e) {
                this.logger.verbose(`Kache read error for ${cacheKey}: ${e}`);
            }
        }
        try {
            const requestData = {
                Latitude: latitude,
                Longitude: longitude,
                APIKey: this.apiKey,
                Variables: ["Cloud", "Seeing", "Transparency"],
            };
            this.logger.info(`No cached value found for ${cacheKey}. Fetching forecast from API.`);
            this.logger.info(`Requesting Astrospheric forecast from URL: ${this.endpoint}`);
            const response = await axios_1.default.post(this.endpoint, requestData, {
                headers: {
                    "Content-Type": "application/json",
                },
                timeout: 30000, // 30 second timeout
            });
            if (response.status === 200) {
                const normalizedResponse = this.normalizeForecastResponse(response.data);
                this.logger.verbose(`Successfully fetched forecast. API Credits used: ${normalizedResponse.APICreditUsedToday ?? normalizedResponse.APICreditCostOfCall ?? 'unknown'}`);
                this.logApiCreditStatus(normalizedResponse, `${locationLabel ?? cacheKey}`);
                if (normalizedResponse)
                    normalizedResponse._source = 'api';
                // write CSV for API-fetched data
                this.writeForecastCSV(cacheKey, normalizedResponse, locationLabel);
                // Cache the result using provided kache
                if (this.kache && this.cacheDurationMs > 0) {
                    try {
                        const expirationTime = Date.now() + this.cacheDurationMs;
                        this.kache.set(cacheKey, normalizedResponse, expirationTime);
                        this.logger.info(`Kache: Adding  ${cacheKey} to cache with expiration in ${this.cacheDurationMs / 60000} minutes`);
                    }
                    catch (e) {
                        this.logger.error(`Kache set error for ${cacheKey}: ${e}`);
                    }
                }
                return normalizedResponse;
            }
            else {
                throw new Error(`Unexpected response status: ${response.status}`);
            }
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                const axiosError = error;
                if (axiosError.response) {
                    this.logger.error(`Astrospheric API error: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`);
                    throw new Error(`Astrospheric API error: ${axiosError.response.status}`);
                }
                else if (axiosError.request) {
                    this.logger.error(`No response from Astrospheric API: ${axiosError.message}`);
                    throw new Error(`No response from Astrospheric API`);
                }
            }
            this.logger.error(`Error fetching forecast: ${error}`);
            throw error;
        }
    }
}
exports.AstrosphericAPI = AstrosphericAPI;
