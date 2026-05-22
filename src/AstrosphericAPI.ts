import axios, { AxiosError } from "axios";
import { Logger } from "./Logger";
import { AstrosphericResponse } from "./types";

interface CacheEntry {
    data: AstrosphericResponse;
    timestamp: number;
}

export class AstrosphericAPI {
    private logger: Logger;
    private apiKey: string;
    private endpoint: string;
    private cache: Map<string, CacheEntry>;
    private cacheDurationMs: number;

    constructor(logger: Logger, apiKey: string, baseURL?: string, cacheDurationMinutes?: number) {
        this.logger = logger;
        this.apiKey = apiKey;
        const base = baseURL || "https://astrosphericpublicaccess.azurewebsites.net/api/";
        this.endpoint = base + "GetForecastData_V1";
        this.cache = new Map();
        this.cacheDurationMs = (cacheDurationMinutes || 0) * 60 * 1000;
        
        if (cacheDurationMinutes && cacheDurationMinutes > 0) {
            this.logger.info(`Cache enabled: ${cacheDurationMinutes} minutes`);
        }
    }

    async getForecast(latitude: number, longitude: number): Promise<AstrosphericResponse> {
        // Check cache first
        const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
        
        if (this.cacheDurationMs > 0) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                const age = Date.now() - cached.timestamp;
                if (age < this.cacheDurationMs) {
                    const ageMinutes = Math.floor(age / 60000);
                    this.logger.verbose(`Using cached forecast for ${cacheKey} (age: ${ageMinutes} minutes)`);
                    return cached.data;
                } else {
                    this.logger.verbose(`Cache expired for ${cacheKey}`);
                    this.cache.delete(cacheKey);
                }
            }
        }

        try {
            const requestData = {
                Latitude: latitude,
                Longitude: longitude,
                APIKey: this.apiKey,
            };

            this.logger.verbose(`Fetching forecast from API for lat: ${latitude}, lon: ${longitude}`);

            const response = await axios.post<AstrosphericResponse>(this.endpoint, requestData, {
                headers: {
                    "Content-Type": "application/json",
                },
                timeout: 30000, // 30 second timeout
            });

            if (response.status === 200) {
                this.logger.verbose(`Successfully fetched forecast. API Credits used: ${response.data.APICreditUsedToday}`);
                
                // Cache the result
                if (this.cacheDurationMs > 0) {
                    this.cache.set(cacheKey, {
                        data: response.data,
                        timestamp: Date.now()
                    });
                    this.logger.verbose(`Cached forecast for ${cacheKey}`);
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
