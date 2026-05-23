import * as PImage from "pureimage";
import * as moment from "moment-timezone";
import * as fs from "fs";
import { Writable } from "stream";
import { Logger } from "./Logger";
import { SkyConditionsConfig, Location, ImageResult, AstrosphericResponse } from "./types";
import { AstrosphericAPI } from "./AstrosphericAPI";

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
    private logger: Logger;

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
    
    private readonly LOCATION_ROW_HEIGHT = 340;  // Height for each location's 3 sub-rows (increased for larger label)
    private readonly SUB_ROW_HEIGHT = 80;        // Height for each data type row (increased spacing)
    
    private readonly TIME_INTERVAL = 1;     // Show every 1 hour
    private readonly NUM_SQUARES = 72;      // 72 hours / 1 hour
    private readonly LABEL_MARGIN = 20;     // Left margin for labels (more room)

    constructor(logger: Logger) {
        this.logger = logger;
        this.logger.info("SkyConditionsImage initialized");
    }

    async getImageStream(config: SkyConditionsConfig): Promise<ImageResult> {
        this.logger.info("Starting sky conditions image generation");
        this.logger.verbose(`Font registration status: ${registeredFont !== null}, Font name: ${registeredFontName}`);
        
        // Create canvas
        const img = PImage.make(this.IMAGE_WIDTH, this.IMAGE_HEIGHT);
        const ctx = img.getContext("2d");

        // Fill background
        ctx.fillStyle = this.BACKGROUND_COLOR;
        ctx.fillRect(0, 0, this.IMAGE_WIDTH, this.IMAGE_HEIGHT);

        // Draw title if provided
        if (config.title) {
            this.drawTitle(ctx, config.title);
        }

        // Fetch data for all locations
        const api = new AstrosphericAPI(this.logger, config.apiKey, config.baseURL, config.cacheDurationMinutes);
        const forecasts: (AstrosphericResponse | null)[] = [];

        for (const location of config.locations) {
            try {
                this.logger.info(`Fetching forecast for ${location.label} (${location.latitude}, ${location.longitude})`);
                const forecast = await api.getForecast(location.latitude, location.longitude);
                forecasts.push(forecast);
            } catch (error) {
                this.logger.error(`Failed to fetch forecast for ${location.label}: ${error}`);
                throw error;
            }
        }

        // Draw time labels (using first forecast)
        const firstForecast = forecasts.find(f => f !== null);

        // Keep the original spacing between location groups; only tighten spacing between the three sub-rows.
        const locationsCount = config.locations.length || 1;
        const locationRowHeight = this.LOCATION_ROW_HEIGHT; // preserve group spacing
        // Internal spacing between the three sub-rows: use square height plus a small gap
        const GAP_BETWEEN_ROWS = 15; // 15px gap between square rows
        const subRowHeight = this.SQUARE_HEIGHT + GAP_BETWEEN_ROWS;

        if (firstForecast) {
            this.drawTimeLabels(ctx, firstForecast);
            // pass both the configured group height and the internal sub-row height so dividers align to squares
            this.drawMidnightLines(ctx, firstForecast, locationsCount, this.LOCATION_ROW_HEIGHT, subRowHeight);
        }

        // Draw each location using original group heights but tighter sub-row spacing
        for (let i = 0; i < config.locations.length; i++) {
            const forecast = forecasts[i];
            if (forecast) {
                const yOffset = this.TOP_MARGIN + i * locationRowHeight;
                this.drawLocation(ctx, config.locations[i], forecast, yOffset, locationRowHeight, subRowHeight);
            }
        }

        // Encode to JPEG
        this.logger.info("Encoding image to JPEG...");
        const jpegData = await this.encodeJPEG(img);
        
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
        const titleY = this.TOP_MARGIN - 120; // move title down so it's not clipped
        ctx.fillText(title, titleX, titleY);
        this.logger.verbose(`  Title position: (${titleX}, 40)`);
    }

    private drawTimeLabels(ctx: any, forecast: AstrosphericResponse): void {
        this.logger.verbose("Drawing time labels");
        
        if (!forecast || !forecast.RDPS_CloudCover || forecast.RDPS_CloudCover.length === 0) {
            this.logger.warn("No forecast data available for time labels");
            return;
        }

        ctx.fillStyle = this.TEXT_COLOR;
        ctx.font = `36pt '${registeredFontName}'`;
        
        const startTime = moment.tz(forecast.UTCStartTime, "UTC");
        this.logger.verbose(`Forecast start time: ${startTime.format('YYYY-MM-DD HH:mm')} UTC`);

        // Draw day-of-week labels centered over each 24-hour day block.
        let labelCount = 0;
        const prevAlign = ctx.textAlign || 'start';
        const prevBaseline = ctx.textBaseline || 'alphabetic';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        // Find day-start indices (midnight) and compute center of each day block
        const dayStartIndices: number[] = [];
        for (let i = 0; i < this.NUM_SQUARES; i++) {
            const t = startTime.clone().add(i * this.TIME_INTERVAL, 'hours');
            if (t.hour() === 0) dayStartIndices.push(i);
        }
        // If the first dayStart isn't at 0, include 0 as start
        if (dayStartIndices.length === 0 || dayStartIndices[0] !== 0) {
            dayStartIndices.unshift(0);
        }
        for (let idx = 0; idx < dayStartIndices.length; idx++) {
            const startIdx = dayStartIndices[idx];
            // place label at noon (12 hours after start)
            const noonIdx = Math.min(startIdx + 12, this.NUM_SQUARES - 1);
            const dayLabelTime = startTime.clone().add(noonIdx * this.TIME_INTERVAL, 'hours');
            const dayLabel = dayLabelTime.format('dddd');
            const x = this.LEFT_MARGIN + noonIdx * this.SQUARE_WITH_BORDER + this.SQUARE_WIDTH / 2;
            const labelY = this.TOP_MARGIN - 12;
            ctx.fillText(dayLabel, x, labelY);
            labelCount++;
        }
        ctx.textAlign = prevAlign as any;
        ctx.textBaseline = prevBaseline as any;
        this.logger.verbose(`  Drew ${labelCount} day labels`);
    }

    private drawMidnightLines(ctx: any, forecast: AstrosphericResponse, locationsCount: number, locationRowHeight: number, subRowHeight: number): void {
        this.logger.verbose("Drawing midnight grid lines");
        
        if (!forecast || !forecast.RDPS_CloudCover || forecast.RDPS_CloudCover.length === 0) {
            return;
        }
        // Draw vertical day dividers for each location block only (not between locations)
        ctx.strokeStyle = this.GRID_COLOR;
        ctx.lineWidth = 3; // 3x thicker than original

        for (let i = 0; i < this.NUM_SQUARES; i++) {
            const hourIndex = i * this.TIME_INTERVAL;
            // Check if this hour is midnight (hour 0) and not the very first
            if (hourIndex > 0 && hourIndex % 24 === 0) {
                const x = this.LEFT_MARGIN + i * this.SQUARE_WITH_BORDER;
                // draw segment for each configured location row
                for (let loc = 0; loc < locationsCount; loc++) {
                    // top of Sky Cover square (yOffset)
                    const yOffset = this.TOP_MARGIN + loc * locationRowHeight;
                    const yStart = yOffset; // top of Sky Cover square
                    // bottom of Wind Speed square: yOffset + subRowHeight*2 + SQUARE_HEIGHT
                    const yEnd = yOffset + subRowHeight * 2 + this.SQUARE_HEIGHT;
                    ctx.beginPath();
                    ctx.moveTo(x, yStart);
                    ctx.lineTo(x, yEnd);
                    ctx.stroke();
                }
            }
        }
    }

    private drawLocation(ctx: any, location: Location, forecast: AstrosphericResponse, yOffset: number, locationRowHeight: number, subRowHeight: number): void {
        this.logger.info(`Drawing location: ${location.label} at yOffset=${yOffset}`);

        // Draw location label above the rows (larger, with more space below)
        ctx.fillStyle = this.TEXT_COLOR;
        ctx.font = `64pt '${registeredFontName}'`;
        const labelY = yOffset - 60; // move label further above rows to give more space
        ctx.fillText(location.label, this.LABEL_MARGIN, labelY);
        this.logger.verbose(`  Location label: "${location.label}" at (${this.LABEL_MARGIN}, ${labelY})`);
        // ensure subsequent labels align left
        ctx.textAlign = 'left';

        // Draw labels for each data type (to the left of each row)
        ctx.font = `36pt '${registeredFontName}'`;
        ctx.fillText("Sky Cover", this.LABEL_MARGIN, yOffset + this.SQUARE_HEIGHT / 2 + 5);
        ctx.fillText("Seeing", this.LABEL_MARGIN, yOffset + subRowHeight + this.SQUARE_HEIGHT / 2 + 5);
        ctx.fillText("Wind Speed", this.LABEL_MARGIN, yOffset + subRowHeight * 2 + this.SQUARE_HEIGHT / 2 + 5);
        this.logger.verbose(`  Row labels drawn`);

        // Get current time in this location's timezone
        const currentTime = moment.tz(location.timezone);
        this.logger.verbose(`  Current time in ${location.timezone}: ${currentTime.format('YYYY-MM-DD HH:mm')}`);

        // Draw squares for each 2-hour period
        for (let i = 0; i < this.NUM_SQUARES && i * this.TIME_INTERVAL < forecast.RDPS_CloudCover.length; i++) {
            const hourIndex = i * this.TIME_INTERVAL;
            const x = this.LEFT_MARGIN + i * this.SQUARE_WITH_BORDER;

            // Sky Cover (Cloud Cover)
            const cloudData = forecast.RDPS_CloudCover[hourIndex];
            const cloudPercent = cloudData?.Value?.ActualValue ?? null;
            if (cloudPercent !== null) {
                ctx.fillStyle = this.getCloudCoverColor(cloudPercent);
                ctx.fillRect(x, yOffset, this.SQUARE_WIDTH, this.SQUARE_HEIGHT);
                
                if (i < 3) {
                    this.logger.verbose(`  Cloud[${i}]=${cloudPercent.toFixed(1)}%`);
                }
            }

            // Seeing
            const seeingData = forecast.Astrospheric_Seeing[hourIndex];
            const seeingValue = seeingData?.Value?.ActualValue ?? null;
            if (seeingValue !== null) {
                ctx.fillStyle = this.getSeeingColor(seeingValue);
                ctx.fillRect(x, yOffset + subRowHeight, this.SQUARE_WIDTH, this.SQUARE_HEIGHT);
                
                if (i < 3) {
                    this.logger.verbose(`  Seeing[${i}]=${seeingValue.toFixed(1)}`);
                }
            }

            // Wind Speed
            const windData = forecast.RDPS_WindVelocity[hourIndex];
            const windMs = windData?.Value?.ActualValue ?? null;
            if (windMs !== null) {
                const windMph = windMs * 2.237; // Convert m/s to mph
                ctx.fillStyle = this.getWindSpeedColor(windMph);
                ctx.fillRect(x, yOffset + subRowHeight * 2, this.SQUARE_WIDTH, this.SQUARE_HEIGHT);
                
                if (i < 3) {
                    this.logger.verbose(`  Wind[${i}]=${windMs.toFixed(1)}m/s (${windMph.toFixed(1)}mph)`);
                }
            }
        }

        // current time line removed by request
     }

    private getCloudCoverColor(cloudPercent: number): string {
        // Inverted scale: 0% = best (dark blue), higher % = worse (white)
        if (cloudPercent <= 0) return "#00008B";      // Very dark blue
        if (cloudPercent <= 10) return "#0000CD";     // Medium dark blue
        if (cloudPercent <= 20) return "#0000FF";     // Medium blue
        if (cloudPercent <= 50) return "#4169E1";     // Light medium blue
        if (cloudPercent <= 80) return "#87CEEB";     // Light blue
        return "#FFFFFF";                              // White
    }

    private getSeeingColor(seeingValue: number): string {
        // 0 = best (white), 4+ = worst (dark blue)
        if (seeingValue <= 0) return "#FFFFFF";       // White
        if (seeingValue <= 1) return "#87CEEB";       // Light blue
        if (seeingValue <= 2) return "#0000FF";       // Medium blue
        if (seeingValue <= 3) return "#0000CD";       // Medium dark blue
        return "#00008B";                              // Very dark blue
    }

    private getWindSpeedColor(windMph: number): string {
        // 0-5 mph = best (dark blue), 20+ mph = worst (white)
        if (windMph <= 5) return "#00008B";           // Very dark blue
        if (windMph <= 10) return "#0000CD";          // Medium dark blue
        if (windMph <= 15) return "#0000FF";          // Medium blue
        if (windMph <= 20) return "#87CEEB";          // Light blue
        return "#FFFFFF";                              // White
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
