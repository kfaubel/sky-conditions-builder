import * as PImage from "pureimage";
import * as moment from "moment-timezone";
import * as fs from "fs";
import { Logger } from "./Logger";
import { SkyConditionsConfig, Location, ImageResult, AstrosphericResponse, HourValue } from "./types";
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
    
    private readonly LEFT_MARGIN = 200;     // Space for row labels
    private readonly TOP_MARGIN = 100;      // Space for title and time labels
    private readonly SQUARE_SIZE = 40;      // 40x40 pixel squares
    private readonly SQUARE_BORDER = 2;     // Border between squares
    private readonly SQUARE_WITH_BORDER = this.SQUARE_SIZE + this.SQUARE_BORDER;
    
    private readonly LOCATION_ROW_HEIGHT = 280;  // Height for each location's 3 sub-rows
    private readonly SUB_ROW_HEIGHT = 60;        // Height for each data type row
    
    private readonly TIME_INTERVAL = 2;     // Show every 2 hours
    private readonly NUM_SQUARES = 36;      // 72 hours / 2 hours
    private readonly LABEL_MARGIN = 10;     // Left margin for labels

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
        if (firstForecast) {
            this.drawTimeLabels(ctx, firstForecast);
            this.drawMidnightLines(ctx, firstForecast);
        }

        // Draw each location
        for (let i = 0; i < config.locations.length; i++) {
            const forecast = forecasts[i];
            if (forecast) {
                const yOffset = this.TOP_MARGIN + i * this.LOCATION_ROW_HEIGHT;
                this.drawLocation(ctx, config.locations[i], forecast, yOffset);
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
        ctx.fillText(title, titleX, 40);
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

        // Draw time label every 12 hours (6 squares)
        let labelCount = 0;
        for (let i = 0; i < this.NUM_SQUARES; i++) {
            if (i % 6 === 0) { // Every 12 hours
                const timeForSquare = startTime.clone().add(i * this.TIME_INTERVAL, "hours");
                const label = timeForSquare.hour() === 0 ? "12AM" : "12PM";
                const x = this.LEFT_MARGIN + i * this.SQUARE_WITH_BORDER;
                ctx.fillText(label, x, this.TOP_MARGIN - 10);
                labelCount++;
            }
        }
        this.logger.verbose(`  Drew ${labelCount} time labels`);
    }

    private drawMidnightLines(ctx: any, forecast: AstrosphericResponse): void {
        this.logger.verbose("Drawing midnight grid lines");
        
        if (!forecast || !forecast.RDPS_CloudCover || forecast.RDPS_CloudCover.length === 0) {
            return;
        }

        const startTime = moment.tz(forecast.UTCStartTime, "UTC");
        let lineCount = 0;

        ctx.strokeStyle = this.GRID_COLOR;
        ctx.lineWidth = 1;

        for (let i = 0; i < this.NUM_SQUARES; i++) {
            const hourIndex = i * this.TIME_INTERVAL;
            
            // Check if this hour is midnight (hour 0)
            if (hourIndex > 0 && hourIndex % 24 === 0) {
                const x = this.LEFT_MARGIN + i * this.SQUARE_WITH_BORDER;
                ctx.beginPath();
                ctx.moveTo(x, this.TOP_MARGIN);
                ctx.lineTo(x, this.IMAGE_HEIGHT - 20);
                ctx.stroke();
                lineCount++;
            }
        }
        this.logger.verbose(`  Drew ${lineCount} midnight lines`);
    }

    private drawLocation(ctx: any, location: Location, forecast: AstrosphericResponse, yOffset: number): void {
        this.logger.info(`Drawing location: ${location.label} at yOffset=${yOffset}`);

        // Draw location label above the rows
        ctx.fillStyle = this.TEXT_COLOR;
        ctx.font = `48pt '${registeredFontName}'`;
        ctx.fillText(location.label, this.LABEL_MARGIN, yOffset - 10);
        this.logger.verbose(`  Location label: "${location.label}" at (${this.LABEL_MARGIN}, ${yOffset - 10})`);

        // Draw labels for each data type (to the left of each row)
        ctx.font = `36pt '${registeredFontName}'`;
        ctx.fillText("Sky Cover", this.LABEL_MARGIN, yOffset + this.SQUARE_SIZE / 2 + 5);
        ctx.fillText("Seeing", this.LABEL_MARGIN, yOffset + this.SUB_ROW_HEIGHT + this.SQUARE_SIZE / 2 + 5);
        ctx.fillText("Wind Speed", this.LABEL_MARGIN, yOffset + this.SUB_ROW_HEIGHT * 2 + this.SQUARE_SIZE / 2 + 5);
        this.logger.verbose(`  Row labels drawn`);

        // Get current time in this location's timezone
        const startTime = moment.tz(forecast.UTCStartTime, "UTC");
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
                ctx.fillRect(x, yOffset, this.SQUARE_SIZE, this.SQUARE_SIZE);
                
                if (i < 3) {
                    this.logger.verbose(`  Cloud[${i}]=${cloudPercent.toFixed(1)}%`);
                }
            }

            // Seeing
            const seeingData = forecast.Astrospheric_Seeing[hourIndex];
            const seeingValue = seeingData?.Value?.ActualValue ?? null;
            if (seeingValue !== null) {
                ctx.fillStyle = this.getSeeingColor(seeingValue);
                ctx.fillRect(x, yOffset + this.SUB_ROW_HEIGHT, this.SQUARE_SIZE, this.SQUARE_SIZE);
                
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
                ctx.fillRect(x, yOffset + this.SUB_ROW_HEIGHT * 2, this.SQUARE_SIZE, this.SQUARE_SIZE);
                
                if (i < 3) {
                    this.logger.verbose(`  Wind[${i}]=${windMs.toFixed(1)}m/s (${windMph.toFixed(1)}mph)`);
                }
            }
        }

        // Draw current time line
        this.drawCurrentTimeLine(ctx, forecast, currentTime, yOffset);
    }

    private drawCurrentTimeLine(ctx: any, forecast: AstrosphericResponse, currentTime: moment.Moment, yOffset: number): void {
        const startTime = moment.tz(forecast.UTCStartTime, "UTC");
        const hoursFromStart = currentTime.diff(startTime, "hours", true);
        
        this.logger.verbose(`  Hours from forecast start: ${hoursFromStart.toFixed(2)}`);

        if (hoursFromStart >= 0 && hoursFromStart <= this.NUM_SQUARES * this.TIME_INTERVAL) {
            const squarePosition = hoursFromStart / this.TIME_INTERVAL;
            const x = this.LEFT_MARGIN + squarePosition * this.SQUARE_WITH_BORDER;
            
            ctx.strokeStyle = this.CURRENT_TIME_COLOR;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, yOffset);
            ctx.lineTo(x, yOffset + this.LOCATION_ROW_HEIGHT - 40);
            ctx.stroke();
            
            this.logger.verbose(`  Current time line drawn at x=${x.toFixed(1)}`);
        }
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
            const { Writable } = require("stream");
            
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
