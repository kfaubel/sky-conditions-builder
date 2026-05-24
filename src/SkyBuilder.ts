/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { LoggerInterface } from "./Logger";
import { KacheInterface } from "./Kache";
import { ImageWriterInterface } from "./SimpleImageWriter";
import { SkyConditionsImage } from "./SkyConditionsImage";
import { SkyConditionsConfig } from "./types";

export class SkyConditionsBuilder {
    private logger: LoggerInterface;
    private cache: KacheInterface;
    private writer: ImageWriterInterface;

    constructor(logger: LoggerInterface, cache: KacheInterface, writer: ImageWriterInterface) {
        this.logger = logger;
        this.cache = cache; 
        this.writer = writer;
    }

    public async CreateImage(config: SkyConditionsConfig): Promise<boolean>{
        try {
            const skyConditionsImage: SkyConditionsImage = new SkyConditionsImage(this.logger, this.writer, this.cache);

            const result = await skyConditionsImage.getImage(config.title, config.apiKey, config.baseURL, config.cacheDurationMinutes, config.locations, config.outputFilename);
            
            if (result !== null) {
                this.logger.info(`WeatherBuilder: Writing: ${config.outputFilename}`);
                // Ensure we pass a Buffer to saveFile; ImageResult (e.g. from jpeg-js) has a .data (Uint8Array)
                let bufToSave: Buffer;
                if (Buffer.isBuffer(result)) {
                    bufToSave = result;
                } else if ((result as any).data && (result as any).data instanceof Uint8Array) {
                    bufToSave = Buffer.from((result as any).data);
                } else if ((result as any).data && Array.isArray((result as any).data)) {
                    bufToSave = Buffer.from((result as any).data as number[]);
                } else {
                    // Fallback: stringify any other result to UTF-8
                    bufToSave = Buffer.from(String(result), 'utf8');
                }
                this.writer.saveFile(config.outputFilename, bufToSave);
            } else {
                this.logger.warn(`WeatherBuilder: No image for ${config.outputFilename}`);
                return false;
            }
        } catch (e) {
            this.logger.error(`WeatherBuilder: Exception: ${e as Error} ${(e as Error).stack}`);
            return false;
        }

        return true;
    }
}
