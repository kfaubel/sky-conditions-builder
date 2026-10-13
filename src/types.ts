export interface Location {
    label: string;
    latitude: number;
    longitude: number;
    timezone: string;
}

export interface SkyConditionsConfig {
    apiKey: string;
    title: string;
    baseURL: string;
    outputFilename: string;
    cacheDurationMinutes: number;
    locations: Location[];
}

export interface HourValue {
    Value: {
        ValueColor: string;
        ActualValue: number;
    };
    HourOffset: number;
    UTCForecastHour?: string;
}

export interface ForecastMetricValue {
    ValueColor?: string;
    ActualValue?: number;
}

export interface HourlyForecastEntry {
    UTCForecastHour?: string;
    HourOffset?: number;
    Cloud?: ForecastMetricValue | null;
    Seeing?: ForecastMetricValue | null;
    Wind?: ForecastMetricValue | null;
    Temperature?: ForecastMetricValue | null;
    DewPoint?: ForecastMetricValue | null;
    WindDirection?: ForecastMetricValue | null;
    Transparency?: ForecastMetricValue | null;
    Smoke?: ForecastMetricValue | null;
    GFSCloud?: ForecastMetricValue | null;
    ICONCloud?: ForecastMetricValue | null;
}

export interface AstrosphericResponse {
    TimeZone: string;
    UTCMinuteOffset?: number;
    ModelTime?: string;
    HourForecastTime?: string;
    Latitude: number;
    Longitude: number;
    LocalStartTime?: string;
    UTCStartTime?: string;
    APICreditUsedToday?: number;
    APICreditCostOfCall?: number;
    APICreditsRemaining?: number;
    APICreditsRemainingToday?: number;
    Cloud?: HourValue[] | ForecastMetricValue;
    Seeing?: HourValue[] | ForecastMetricValue;
    Wind?: HourValue[] | ForecastMetricValue;
    Temperature?: HourValue[] | ForecastMetricValue;
    DewPoint?: HourValue[] | ForecastMetricValue;
    WindDirection?: HourValue[] | ForecastMetricValue;
    Transparency?: HourValue[] | ForecastMetricValue;
    Astrospheric_Seeing?: HourValue[];
    RDPS_CloudCover?: HourValue[];
    RDPS_WindVelocity?: HourValue[];
    RDPS_Temperature?: HourValue[];
    RDPS_DewPoint?: HourValue[];
    RDPS_WindDirection?: HourValue[];
    Astrospheric_Transparency?: HourValue[];
    HourlyForecast?: HourlyForecastEntry[];
}

export interface ImageResult {
    jpegImg: {
        data: Buffer;
        mimeType: string;
    } | null;
}
