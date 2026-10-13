import * as Astronomy from "astronomy-engine";
import * as moment from "moment-timezone";
import type { LoggerInterface } from "./Logger";
import type { KacheInterface } from "./Kache";
import type { Location } from "./types";

export interface SunTimes {
    sunriseLocal: moment.Moment;
    sunsetLocal: moment.Moment;
    source: "astronomy-engine" | "approx";
}

interface SunTimesCacheRecord {
    sunriseISO: string;
    sunsetISO: string;
    source: "astronomy-engine" | "approx";
}

export class SunTimesService {
    private readonly logger: LoggerInterface;
    private readonly kache?: KacheInterface | null;

    constructor(logger: LoggerInterface, kache?: KacheInterface | null) {
        this.logger = logger;
        this.kache = kache ?? null;
    }

    public async getSunTimes(location: Location, localDate: moment.Moment): Promise<SunTimes> {
        const dateKey = localDate.format("YYYY-MM-DD");
        const cacheKey = `sun-times:${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}:${dateKey}`;

        const cached = this.kache?.get(cacheKey) as SunTimesCacheRecord | null;
        if (cached?.sunriseISO && cached?.sunsetISO) {
            const cachedSunrise = moment.tz(cached.sunriseISO, location.timezone);
            const cachedSunset = moment.tz(cached.sunsetISO, location.timezone);
            // Ignore stale/bad cache where the sunset lands on the wrong local date
            // or daylight duration is unrealistic.
            if (this.isReasonableSunWindow(cachedSunrise, cachedSunset, localDate)) {
                return {
                    sunriseLocal: cachedSunrise,
                    sunsetLocal: cachedSunset,
                    source: cached.source || "approx",
                };
            }
            this.logger.warn(`Ignoring invalid cached sun times for ${location.label} ${dateKey}`);
        }

        const approx = this.computeApproximateSunTimes(localDate, location.latitude, location.longitude, location.timezone);
        let chosen: SunTimes = {
            sunriseLocal: approx.sunriseLocal,
            sunsetLocal: approx.sunsetLocal,
            source: "approx",
        };

        // Approximation is always computed first so we can render without any external service.
        // Astronomy Engine is then used to refine the result.
        try {
            const engineTimes = this.computeWithAstronomyEngine(location, localDate);
            if (engineTimes) {
                chosen = engineTimes;
            }
        } catch (error) {
            this.logger.warn(`Astronomy Engine sun-time calculation failed for ${location.label} ${dateKey}; using approximation. ${error}`);
        }

        if (this.kache) {
            const expiration = localDate.clone().add(1, "day").startOf("day").valueOf();
            const record: SunTimesCacheRecord = {
                sunriseISO: chosen.sunriseLocal.toISOString(),
                sunsetISO: chosen.sunsetLocal.toISOString(),
                source: chosen.source,
            };
            this.kache.set(cacheKey, record, expiration);
            this.logger.verbose(`Cached sun times for ${location.label} ${dateKey} until local midnight`);
        }

        return chosen;
    }

    private computeWithAstronomyEngine(location: Location, localDate: moment.Moment): SunTimes | null {
        const observer = new Astronomy.Observer(location.latitude, location.longitude, 0);
        const localMidnight = localDate.clone().startOf("day");
        const localNoon = localDate.clone().startOf("day").add(12, "hours");
        const sunriseEvent = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, localMidnight.toDate(), 2);
        const sunsetEvent = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, localNoon.toDate(), 2);

        if (!sunriseEvent || !sunsetEvent) {
            return null;
        }

        const sunriseLocal = moment.tz(sunriseEvent.date, location.timezone);
        const sunsetLocal = moment.tz(sunsetEvent.date, location.timezone);
        if (!sunriseLocal.isValid() || !sunsetLocal.isValid()) {
            return null;
        }

        if (!this.isReasonableSunWindow(sunriseLocal, sunsetLocal, localDate)) {
            return null;
        }

        return {
            sunriseLocal,
            sunsetLocal,
            source: "astronomy-engine",
        };
    }

    private computeApproximateSunTimes(localDate: moment.Moment, latitude: number, longitude: number, timezone: string): { sunriseLocal: moment.Moment; sunsetLocal: moment.Moment } {
        const day = localDate.clone().startOf("day");
        const sunriseUTC = this.computeUtcHour(day, latitude, longitude, true);
        const sunsetUTC = this.computeUtcHour(day, latitude, longitude, false);

        const sunrise = day.clone().utc().startOf("day").add(sunriseUTC, "hours").tz(timezone);
        const sunset = day.clone().utc().startOf("day").add(sunsetUTC, "hours").tz(timezone);

        return {
            sunriseLocal: sunrise,
            sunsetLocal: sunset,
        };
    }

    private computeUtcHour(localDay: moment.Moment, latitude: number, longitude: number, sunrise: boolean): number {
        const zenith = 90.833;
        const n = localDay.dayOfYear();
        const lngHour = longitude / 15;
        const t = sunrise
            ? n + ((6 - lngHour) / 24)
            : n + ((18 - lngHour) / 24);

        const m = (0.9856 * t) - 3.289;
        let l = m + (1.916 * Math.sin(this.degToRad(m))) + (0.020 * Math.sin(this.degToRad(2 * m))) + 282.634;
        l = this.normalizeDegrees(l);

        let ra = this.radToDeg(Math.atan(0.91764 * Math.tan(this.degToRad(l))));
        ra = this.normalizeDegrees(ra);
        const lQuadrant = Math.floor(l / 90) * 90;
        const raQuadrant = Math.floor(ra / 90) * 90;
        ra = ra + (lQuadrant - raQuadrant);
        ra = ra / 15;

        const sinDec = 0.39782 * Math.sin(this.degToRad(l));
        const cosDec = Math.cos(Math.asin(sinDec));

        const cosH = (Math.cos(this.degToRad(zenith)) - (sinDec * Math.sin(this.degToRad(latitude)))) /
            (cosDec * Math.cos(this.degToRad(latitude)));

        // Polar day/night guardrails.
        if (cosH > 1) {
            return 12;
        }
        if (cosH < -1) {
            return sunrise ? 0 : 23.999;
        }

        let h = sunrise
            ? 360 - this.radToDeg(Math.acos(cosH))
            : this.radToDeg(Math.acos(cosH));
        h = h / 15;

        const localMeanTime = h + ra - (0.06571 * t) - 6.622;
        let utc = localMeanTime - lngHour;
        while (utc < 0) utc += 24;
        while (utc >= 24) utc -= 24;
        return utc;
    }

    private normalizeDegrees(deg: number): number {
        let d = deg;
        while (d < 0) d += 360;
        while (d >= 360) d -= 360;
        return d;
    }

    private degToRad(deg: number): number {
        return deg * Math.PI / 180;
    }

    private radToDeg(rad: number): number {
        return rad * 180 / Math.PI;
    }

    private isReasonableSunWindow(sunriseLocal: moment.Moment, sunsetLocal: moment.Moment, localDate: moment.Moment): boolean {
        if (!sunriseLocal.isValid() || !sunsetLocal.isValid()) return false;
        if (!sunsetLocal.isAfter(sunriseLocal)) return false;

        // For non-polar latitudes in this app, sunrise and sunset should map to the same local date.
        if (sunriseLocal.format("YYYY-MM-DD") !== localDate.format("YYYY-MM-DD")) return false;
        if (sunsetLocal.format("YYYY-MM-DD") !== localDate.format("YYYY-MM-DD")) return false;

        const daylightHours = sunsetLocal.diff(sunriseLocal, "minutes") / 60;
        if (daylightHours < 4 || daylightHours > 18) return false;

        return true;
    }
}