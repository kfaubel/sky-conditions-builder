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
}

export interface AstrosphericResponse {
    TimeZone: string;
    UTCMinuteOffset: number;
    ModelTime: string;
    Latitude: number;
    Longitude: number;
    LocalStartTime: string;
    UTCStartTime: string;
    APICreditUsedToday: number;
    Astrospheric_Seeing: HourValue[];
    RDPS_CloudCover: HourValue[];
    RDPS_WindVelocity: HourValue[];
    RDPS_Temperature?: HourValue[];
    RDPS_DewPoint?: HourValue[];
    RDPS_WindDirection?: HourValue[];
    Astrospheric_Transparency?: HourValue[];
}

export interface ImageResult {
    jpegImg: {
        data: Buffer;
        mimeType: string;
    } | null;
}
