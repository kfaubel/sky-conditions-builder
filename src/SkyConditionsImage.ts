import * as PImage from "pureimage";
import * as moment from "moment-timezone";
import * as fs from "fs";
import { Writable } from "stream";
import { LoggerInterface } from "./Logger";
import { Location, ImageResult, AstrosphericResponse } from "./types";
import { AstrosphericAPI } from "./AstrosphericAPI";
import type { ImageWriterInterface } from "./SimpleImageWriter";
import type { KacheInterface } from "./Kache";

// ============================================================================
// CRITICAL: Font must be loaded at module level BEFORE any canvas is created
// ============================================================================
let registeredFont: any = null;
let registeredFontName = "Arial";

function loadSystemFont(): void {
    const fontOptions = [
        { path: "C:\\Windows\\Fonts\\arial.ttf", name: "Arial" },
        { path: "C:\\Windows\\Fonts\\calibri.ttf", name: "Calibri" },
        { path: "C:\\Windows\\Fonts\\verdana.ttf", name: "Verdana" },
        { path: "/System/Library/Fonts/Helvetica.ttc", name: "Helvetica" },
        { path: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", name: "DejaVu Sans" },
        { path: "/usr/share/fonts/liberation/LiberationSans-Regular.ttf", name: "Liberation Sans" }
    ];

    for (const fontOption of fontOptions) {
        if (fs.existsSync(fontOption.path)) {
            try {
                registeredFont = PImage.registerFont(fontOption.path, fontOption.name);
                registeredFont.loadSync();
                registeredFontName = fontOption.name;
                console.log(`[SkyConditionsImage] Font '${fontOption.name}' loaded successfully`);
                return;
            } catch (err) {
                console.error(`[SkyConditionsImage] Failed to load font ${fontOption.name}:`, err);
            }
        }
    }
    console.warn("[SkyConditionsImage] No system font found. Text labels will not appear.");
}

// Execute font loading immediately when module is imported
loadSystemFont();

export class SkyConditionsImage {
    private logger: LoggerInterface;
    private imageWriter?: ImageWriterInterface | null;
    private kache?: KacheInterface | null;

    // Layout parameters
    private readonly IMAGE_WIDTH = 1920;
    private readonly IMAGE_HEIGHT = 1080;
    private readonly BACKGROUND_COLOR = "#333333";
    private readonly TEXT_COLOR = "#FFFFFF";
    private readonly GRID_COLOR = "#666666";
    private readonly CURRENT_TIME_COLOR = "#FF0000";
    
    private readonly LEFT_MARGIN = 260;     // Space for row labels (moved right for larger labels)
    private readonly TOP_MARGIN = 260;      // Space for title and time labels (moved further down)
    private readonly SQUARE_WIDTH = 20;     // Narrow squares horizontally (hours across)
    private readonly SQUARE_HEIGHT = 40;    // Taller squares vertically (previous height)
    private readonly SQUARE_BORDER = 2;     // Border between squares
    private readonly SQUARE_WITH_BORDER = this.SQUARE_WIDTH + this.SQUARE_BORDER;
    
    private readonly LOCATION_ROW_HEIGHT = 290;  // Height for each location's 3 sub-rows (slightly increased spacing)
    private readonly SUB_ROW_HEIGHT = 80;        // Height for each data type row (increased spacing)
    
    private readonly TIME_INTERVAL = 1;     // Show every 1 hour
    private readonly NUM_SQUARES = 72;      // 72 hours / 1 hour
    private readonly LABEL_MARGIN = 25;     // Left margin for labels (more room)

    constructor(logger: LoggerInterface, imageWriter?: ImageWriterInterface | null, kache?: KacheInterface | null) {
        this.logger = logger;
        this.imageWriter = imageWriter ?? null;
        this.kache = kache ?? null;
        this.logger.info("SkyConditionsImage initialized");
    }

    //async getImageStream(config: SkyConditionsConfig): Promise<ImageResult> {
    public async getImage(title: string, apiKey: string, baseURL: string, cacheDurationMinutes: number, locations: Location[], outputFilename: string ): Promise<ImageResult | null> {
        this.logger.info("Starting sky conditions image generation");
        this.logger.verbose(`Font registration status: ${registeredFont !== null}, Font name: ${registeredFontName}`);
        
        // Create canvas
        const img = PImage.make(this.IMAGE_WIDTH, this.IMAGE_HEIGHT);
        const ctx = img.getContext("2d");

        // Fill background
        ctx.fillStyle = this.BACKGROUND_COLOR;
        ctx.fillRect(0, 0, this.IMAGE_WIDTH, this.IMAGE_HEIGHT);

        // Draw title if provided
        if (title) {
            this.drawTitle(ctx, title);
        }

        // Fetch data for all locations using injected kache if provided
        const api = new AstrosphericAPI(this.logger, apiKey, baseURL, cacheDurationMinutes, this.kache ?? null, this.imageWriter ?? null);
        const forecasts: (AstrosphericResponse | null)[] = [];

        for (const location of locations) {
            try {
                this.logger.info(`Fetching forecast for ${location.label} (${location.latitude}, ${location.longitude})`);
                const forecast = await api.getForecast(location.latitude, location.longitude);
                forecasts.push(forecast);
            } catch (error) {
                this.logger.error(`Failed to fetch forecast for ${location.label}: ${error}`);
                throw error;
            }
        }

        // (Time labels and dividers are drawn per-location using the shared global UTC timeline)
        
        const locationRowHeight = this.LOCATION_ROW_HEIGHT; // preserve group spacing
        // Internal spacing between the three sub-rows: use square height plus a small gap
        const GAP_BETWEEN_ROWS = 15; // 15px gap between square rows
        const subRowHeight = this.SQUARE_HEIGHT + GAP_BETWEEN_ROWS;

        // Determine the earliest local midnight across all locations (using each location's current date).
        // Use that as the shared UTC start so the display always shows exactly three days (72 hours)
        // anchored to the earliest local day. This allows locations in later zones to show leading blanks.
        let earliestLocalMidnight: moment.Moment | null = null;
        for (const loc of locations) {
            try {
                const lm = moment.tz(loc.timezone).startOf('day');
                if (!earliestLocalMidnight || lm.isBefore(earliestLocalMidnight)) earliestLocalMidnight = lm;
            } catch (err) {
                // fallback to UTC if timezone invalid
                const lm = moment.utc().startOf('day');
                if (!earliestLocalMidnight || lm.isBefore(earliestLocalMidnight)) earliestLocalMidnight = lm;
            }
        }
        if (!earliestLocalMidnight) earliestLocalMidnight = moment.utc().startOf('day');
        const globalStartUTC = earliestLocalMidnight.clone().tz('UTC');

        // Draw each location using the shared global timeline so columns line up across locations
        for (let i = 0; i < locations.length; i++) {
            const forecast = forecasts[i];
            if (forecast) {
                const yOffset = this.TOP_MARGIN + i * locationRowHeight;
                // Draw day labels and midnight dividers anchored to the shared global timeline
                this.drawTimeLabelsForLocation(ctx, forecast, locations[i], yOffset, globalStartUTC);
                this.drawMidnightLinesForLocation(ctx, forecast, locations[i], yOffset, locationRowHeight, subRowHeight, globalStartUTC);
                this.drawLocation(ctx, locations[i], forecast, yOffset, locationRowHeight, subRowHeight, globalStartUTC);
            }
        }

        // Encode to JPEG
        this.logger.info("Encoding image to JPEG...");
        const jpegData = await this.encodeJPEG(img);

        // If an ImageWriter is injected, use it to save the file using config.outputFilename
        if (this.imageWriter && outputFilename) {
            try {
                this.imageWriter.saveFile(outputFilename, jpegData);
                this.logger.info(`Saved image using injected ImageWriter: ${outputFilename}`);
            } catch (err) {
                this.logger.error(`Failed to save image via ImageWriter: ${err}`);
            }
        }

        return {
            jpegImg: {
                data: jpegData,
                mimeType: "image/jpeg"
            }
        };
    }

    private drawTitle(ctx: any, title: string): void {
        this.logger.verbose(`Drawing title: "${title}"`);
        ctx.fillStyle = this.TEXT_COLOR;
        ctx.font = `72pt '${registeredFontName}'`;
        
        // Center the title
        const titleX = this.IMAGE_WIDTH / 2 - (title.length * 12);
        const titleY = this.TOP_MARGIN - 150; // move title down so it's not clipped
        ctx.fillText(title, titleX, titleY);
        this.logger.verbose(`  Title position: (${titleX}, 40)`);
    }

    private drawTimeLabelsForLocation(ctx: any, forecast: AstrosphericResponse, location: Location, yOffset: number, globalStartUTC: moment.Moment): void {
         this.logger.verbose(`Drawing time labels for ${location.label}`);

         if (!forecast || !forecast.RDPS_CloudCover || forecast.RDPS_CloudCover.length === 0) {
             this.logger.warn("No forecast data available for time labels");
             return;
         }

         ctx.fillStyle = this.TEXT_COLOR;
         // Slightly larger and bold for better readability
         ctx.font = `36pt '${registeredFontName}'`;

         const forecastStartUTC = moment.tz(forecast.UTCStartTime, 'UTC');

         const prevAlign = ctx.textAlign || 'start';
         const prevBaseline = ctx.textBaseline || 'alphabetic';
         ctx.textAlign = 'center';
         ctx.textBaseline = 'bottom';

         let labelCount = 0;
         for (let s = 0; s < this.NUM_SQUARES; s += 24) {
             const end = Math.min(s + 24, this.NUM_SQUARES);

            // Determine if this 24-hour block has any forecast data for this location
            let hasData = false;
            // Determine if any hour in this 24-hour block is available and not stale (>= now for this location)
            const nowForLocationUTC = moment.tz(location.timezone).utc();
            for (let j = s; j < end; j++) {
                const tUTC = globalStartUTC.clone().add(j, 'hours');
                const forecastIndex = tUTC.diff(forecastStartUTC, 'hours');
                if (forecastIndex >= 0 && forecastIndex < forecast.RDPS_CloudCover.length && (tUTC.isSameOrAfter(nowForLocationUTC))) { hasData = true; break; }
            }
            if (!hasData) continue;

            // Pixel center of block
            const blockStartX = this.LEFT_MARGIN + s * this.SQUARE_WITH_BORDER;
            const blockEndX = this.LEFT_MARGIN + (end - 1) * this.SQUARE_WITH_BORDER + this.SQUARE_WIDTH;
            const x = Math.floor((blockStartX + blockEndX) / 2);

            // Representative UTC time (middle of block), show label in local weekday
            const labelIndex = Math.floor((s + end - 1) / 2);
            const labelUTC = globalStartUTC.clone().add(labelIndex, 'hours');
            const dayLabel = labelUTC.clone().tz(location.timezone).format('dddd');
            const labelY = yOffset - 20; // place just above the location rows
            ctx.fillText(dayLabel, x, labelY);
            labelCount++;
        }

        ctx.textAlign = prevAlign as any;
        ctx.textBaseline = prevBaseline as any;
        this.logger.verbose(`  Drew ${labelCount} day labels for ${location.label}`);
    }

    private drawMidnightLinesForLocation(ctx: any, forecast: AstrosphericResponse, location: Location, yOffset: number, locationRowHeight: number, subRowHeight: number, globalStartUTC: moment.Moment): void {
        this.logger.verbose(`Drawing midnight dividers for ${location.label}`);

        if (!forecast || !forecast.RDPS_CloudCover || forecast.RDPS_CloudCover.length === 0) {
            return;
        }

        // much lighter, thinner divider that extends into the label area
        ctx.strokeStyle = '#BBBBBB';
        ctx.lineWidth = 6;

        const forecastStartUTC = moment.tz(forecast.UTCStartTime, 'UTC');

        // yStart should reach into label area where day labels live (labelY ~ yOffset - 20)
        const labelTop = yOffset - 36;
        const yStart = Math.max(40, labelTop); // don't go above title area
        const yEnd = yOffset + subRowHeight * 2 + this.SQUARE_HEIGHT; // bottom of Wind Speed

        for (let i = 0; i < this.NUM_SQUARES; i++) {
            const tUTC = globalStartUTC.clone().add(i, 'hours');
            const local = tUTC.clone().tz(location.timezone);
            if (local.hour() === 0 && i > 0) {
                // check for any forecast data in this 24-hour block
                const forecastIndex = tUTC.diff(forecastStartUTC, 'hours');
                let hasData = false;
                const nowForLocationUTC = moment.tz(location.timezone).utc();
                for (let k = 0; k < 24; k++) {
                    const idx = forecastIndex + k;
                    const hourUTC = tUTC.clone().add(k, 'hours');
                    if (idx >= 0 && idx < forecast.RDPS_CloudCover.length && hourUTC.isSameOrAfter(nowForLocationUTC)) { hasData = true; break; }
                }
                if (!hasData) continue;

                const x = this.LEFT_MARGIN + i * this.SQUARE_WITH_BORDER;
                ctx.beginPath();
                ctx.moveTo(x, yStart);
                ctx.lineTo(x, yEnd);
                ctx.stroke();
            }
        }
    }

    private drawLocation(ctx: any, location: Location, forecast: AstrosphericResponse, yOffset: number, locationRowHeight: number, subRowHeight: number, globalStartUTC: moment.Moment): void {
         this.logger.info(`Drawing location: ${location.label} at yOffset=${yOffset}`);

          // Draw location label above the rows (larger, with more space below)
          ctx.fillStyle = this.TEXT_COLOR;
          ctx.font = `56pt '${registeredFontName}'`;
          const labelY = yOffset - 60; // move label further above rows to give more space
          ctx.fillText(location.label, this.LABEL_MARGIN, labelY);
          this.logger.verbose(`  Location label: "${location.label}" at (${this.LABEL_MARGIN}, ${labelY})`);
          // ensure subsequent labels align left
          ctx.textAlign = 'left';

          // Draw labels for each data type (to the left of each row)
          ctx.font = `30pt '${registeredFontName}'`;
          // Shift labels slightly right for spacing
          const labelOffsetX = this.LABEL_MARGIN + 20;
          ctx.fillText("Clouds", labelOffsetX, yOffset + this.SQUARE_HEIGHT / 2 + 5);
          ctx.fillText("Seeing", labelOffsetX, yOffset + subRowHeight + this.SQUARE_HEIGHT / 2 + 5);
          ctx.fillText("Wind", labelOffsetX, yOffset + subRowHeight * 2 + this.SQUARE_HEIGHT / 2 + 5);
          this.logger.verbose(`  Row labels drawn`);

         // Get current time in this location's timezone
         const currentTime = moment.tz(location.timezone);
         this.logger.verbose(`  Current time in ${location.timezone}: ${currentTime.format('YYYY-MM-DD HH:mm')}`);

        // Draw squares using the shared globalStartUTC so columns align across locations.
        // Always draw empty placeholders for every column, then overlay the data squares when available.
        const forecastStartUTC = moment.tz(forecast.UTCStartTime, 'UTC');
        const EMPTY_SQUARE_COLOR = '#222222';
        for (let j = 0; j < this.NUM_SQUARES; j++) {
            const x = this.LEFT_MARGIN + j * this.SQUARE_WITH_BORDER;

            // Draw empty placeholder for each of the three rows
            ctx.fillStyle = EMPTY_SQUARE_COLOR;
            ctx.fillRect(x, yOffset, this.SQUARE_WIDTH, this.SQUARE_HEIGHT);
            ctx.fillRect(x, yOffset + subRowHeight, this.SQUARE_WIDTH, this.SQUARE_HEIGHT);
            ctx.fillRect(x, yOffset + subRowHeight * 2, this.SQUARE_WIDTH, this.SQUARE_HEIGHT);

            const tUTC = globalStartUTC.clone().add(j, 'hours');
            const nowForLocationUTC = moment.tz(location.timezone).utc();
            const forecastIndex = tUTC.diff(forecastStartUTC, 'hours');
            // If the column represents a time in the past for this location, leave placeholder (skip overlay)
            if (tUTC.isBefore(nowForLocationUTC)) {
                continue;
            }
            // If forecastIndex is before start, skip. If it's beyond available data, fall back to last available index (repeat last hour)
            let indexToUse = forecastIndex;
            if (forecastIndex < 0) {
                continue;
            }
            const lastIndex = Math.max(0, forecast.RDPS_CloudCover.length - 1);
            if (forecastIndex > lastIndex) {
                indexToUse = lastIndex; // repeat last known hour
            }

            // Sky Cover (Cloud Cover)
            const cloudData = forecast.RDPS_CloudCover[indexToUse];
            const cloudPercent = cloudData?.Value?.ActualValue ?? null;
            if (cloudPercent !== null) {
                ctx.fillStyle = this.getCloudCoverColor(cloudPercent);
                ctx.fillRect(x, yOffset, this.SQUARE_WIDTH, this.SQUARE_HEIGHT);
            }

            // Seeing
            const seeingData = forecast.Astrospheric_Seeing[indexToUse];
            const seeingValue = seeingData?.Value?.ActualValue ?? null;
            if (seeingValue !== null) {
                ctx.fillStyle = this.getSeeingColor(seeingValue);
                ctx.fillRect(x, yOffset + subRowHeight, this.SQUARE_WIDTH, this.SQUARE_HEIGHT);
            }

            // Wind Speed
            const windData = forecast.RDPS_WindVelocity[indexToUse];
            const windMs = windData?.Value?.ActualValue ?? null;
            if (windMs !== null) {
                const windMph = windMs * 2.237; // Convert m/s to mph
                ctx.fillStyle = this.getWindSpeedColor(windMph);
                ctx.fillRect(x, yOffset + subRowHeight * 2, this.SQUARE_WIDTH, this.SQUARE_HEIGHT);
            }
         }

        // current time line removed by request
     }

    private getCloudCoverColor(cloudPercent: number): string {
        // Map 0-100% to a mid-muted color gradient (between the original vivid scale and the prior desaturated one)
        const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
        const hexToRgb = (hex: string) => {
            const h = hex.replace('#', '');
            return {
                r: parseInt(h.substring(0, 2), 16),
                g: parseInt(h.substring(2, 4), 16),
                b: parseInt(h.substring(4, 6), 16)
            };
        };
        const rgbToHex = (r: number, g: number, b: number) => {
            const toHex = (n: number) => ('0' + Math.round(n).toString(16)).slice(-2);
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        };

        const stops = [
            { p: 0.0, c: '#041a4a' }, // deeper, slightly bluer than muted
            { p: 0.25, c: '#163f75' }, // more blue but not vivid
            { p: 0.5, c: '#6eaed3' }, // softened cyan
            { p: 0.85, c: '#bfc5c8' }, // light gray with a touch of blue
            { p: 1.0, c: '#f0f0f0' }  // near-white
        ];

        const t = clamp(cloudPercent / 100.0, 0, 1);
        // find interval
        let left = stops[0];
        let right = stops[stops.length - 1];
        for (let i = 0; i < stops.length - 1; i++) {
            if (t >= stops[i].p && t <= stops[i + 1].p) {
                left = stops[i];
                right = stops[i + 1];
                break;
            }
        }
        const localT = (t - left.p) / (right.p - left.p || 1);
        const lr = hexToRgb(left.c);
        const rr = hexToRgb(right.c);
        const r = lr.r + (rr.r - lr.r) * localT;
        const g = lr.g + (rr.g - lr.g) * localT;
        const b = lr.b + (rr.b - lr.b) * localT;
        return rgbToHex(r, g, b);
    }

    private getSeeingColor(seeingValue: number): string {
        // Map integer seeing grades (0-5) to colors midway between vivid and muted palettes.
        if (seeingValue === null || isNaN(seeingValue)) return '#ffffff';
        const v = Math.round(seeingValue);
        const clamp = (n: number, a = 0, b = 5) => Math.max(a, Math.min(b, n));
        const idx = clamp(v, 0, 5);
        const map: { [k: number]: string } = {
            0: '#ffffff', // Cloudy (white)
            1: '#c8c8c8', // Poor (light gray)
            2: '#95bfd6', // Below Average (soft light blue)
            3: '#86c0e6', // Average (soft sky blue)
            4: '#2f57b0', // Above Average (moderate blue)
            5: '#0b3160'  // Excellent (deep blue)
        };
        return map[idx];
    }

    private getWindSpeedColor(windMph: number): string {
        // Desaturated-but-slightly-richer palette for wind speed
        if (windMph <= 5) return '#02182e';    // very dark slate-blue
        if (windMph <= 10) return '#163f66';   // muted deep blue
        if (windMph <= 15) return '#31678f';   // medium blue
        if (windMph <= 20) return '#6f93b0';   // lighter blue-gray
        return '#cfd7dc';                      // pale gray for very high wind
    }

    private async encodeJPEG(image: any): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            
            const writeStream = new Writable({
                write(chunk: Buffer, encoding: string, callback: () => void) {
                    chunks.push(chunk);
                    callback();
                }
            });

            writeStream.on("finish", () => {
                resolve(Buffer.concat(chunks));
            });

            writeStream.on("error", (error: Error) => {
                reject(error);
            });

            PImage.encodeJPEGToStream(image, writeStream, 90).then(() => {
                writeStream.end();
            }).catch(reject);
        });
    }
}
