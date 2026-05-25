import axios, { AxiosError } from "axios";
import * as fs from 'fs';
import * as moment from 'moment-timezone';
import { LoggerInterface } from "./Logger";
import { AstrosphericResponse } from "./types";
import type { KacheInterface } from "./Kache";
import type { ImageWriterInterface } from "./SimpleImageWriter";

export class AstrosphericAPI {
    private logger: LoggerInterface;
    private apiKey: string;
    private endpoint: string;
    // Optional disk-backed cache (Kache)
    private kache?: KacheInterface | null;
    private imageWriter?: ImageWriterInterface | null;
    private cacheDurationMs: number;

    constructor(logger: LoggerInterface, apiKey: string, baseURL?: string, cacheDurationMinutes?: number, kache?: KacheInterface | null, imageWriter?: ImageWriterInterface | null) {
        this.logger = logger;
        this.apiKey = apiKey;
        const base = baseURL || "https://astrosphericpublicaccess.azurewebsites.net/api/";
        this.endpoint = base + "GetForecastData_V1";
        this.kache = kache ?? null;
        this.imageWriter = imageWriter ?? null;
        this.cacheDurationMs = (cacheDurationMinutes || 0) * 60 * 1000;
        
        if (cacheDurationMinutes && cacheDurationMinutes > 0) {
            this.logger.info(`Cache enabled: ${cacheDurationMinutes} minutes`);
        }
    }

    // Write a CSV file containing UTC/local timestamps and the primary forecast values for
    // cloud cover, seeing and wind speed. Filename is derived from the location label when provided.
    private writeForecastCSV(cacheKey: string, data: AstrosphericResponse, locationLabel?: string): void {
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

            const lines: string[] = [];
            lines.push('UTC_Date,UTC_Time,Local_Date,Local_Time,CloudPercent,SeeingValue,Wind_m_s,Source');
            const source = (data as any)._source || '';
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
                } catch (e) {
                    this.logger.error(`ImageWriter failed to write CSV ${filename}: ${e}`);
                    fs.writeFileSync(filename, content, 'utf8');
                    this.logger.verbose(`Wrote forecast CSV fallback: ${filename}`);
                }
            } else {
                fs.writeFileSync(filename, content, 'utf8');
                this.logger.verbose(`Wrote forecast CSV: ${filename}`);
            }
        } catch (err) {
            this.logger.error(`Failed to write forecast CSV for ${cacheKey}: ${err}`);
        }
    }

    async getForecast(latitude: number, longitude: number, locationLabel?: string): Promise<AstrosphericResponse> {
        // Check cache first
        // Use higher precision so nearby locations do not collapse to the same key/filename.
        const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
        
        // If a disk-backed Kache is provided, consult it first
        if (this.kache) {
            try {
                const cached = this.kache.get(cacheKey) as AstrosphericResponse | null;
                if (cached) {
                    if ((cached as any)._source === undefined) (cached as any)._source = 'cached';
                    this.writeForecastCSV(cacheKey, cached, locationLabel);
                    this.logger.info(`Using cached value from Kache for sky conditions ${cacheKey}`);
                    return cached;
                }
            } catch (e) {
                this.logger.verbose(`Kache read error for ${cacheKey}: ${e}`);
            }
        }

        try {
            const requestData = {
                Latitude: latitude,
                Longitude: longitude,
                APIKey: this.apiKey,
            };

            this.logger.info(`No cached value found for ${cacheKey}. Fetching forecast from API.`);

            const response = await axios.post<AstrosphericResponse>(this.endpoint, requestData, {
                headers: {
                    "Content-Type": "application/json",
                },
                timeout: 30000, // 30 second timeout
            });

            if (response.status === 200) {
                this.logger.verbose(`Successfully fetched forecast. API Credits used: ${response.data.APICreditUsedToday}`);
                
                if (response && response.data) (response.data as any)._source = 'api';
                // write CSV for API-fetched data
                this.writeForecastCSV(cacheKey, response.data, locationLabel);

                // Cache the result using provided kache
                if (this.kache && this.cacheDurationMs > 0) {
                    try {
                        const expirationTime = Date.now() + this.cacheDurationMs;
                        this.kache.set(cacheKey, response.data, expirationTime);
                        this.logger.info(`Kache: Adding  ${cacheKey} to cache with expiration in ${this.cacheDurationMs / 60000} minutes`);
                    } catch (e) {
                        this.logger.error(`Kache set error for ${cacheKey}: ${e}`);
                    }
                }
                
                return response.data;
            } else {
                throw new Error(`Unexpected response status: ${response.status}`);
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                if (axiosError.response) {
                    this.logger.error(`Astrospheric API error: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`);
                    throw new Error(`Astrospheric API error: ${axiosError.response.status}`);
                } else if (axiosError.request) {
                    this.logger.error(`No response from Astrospheric API: ${axiosError.message}`);
                    throw new Error(`No response from Astrospheric API`);
                }
            }
            this.logger.error(`Error fetching forecast: ${error}`);
            throw error;
        }
    }
}
