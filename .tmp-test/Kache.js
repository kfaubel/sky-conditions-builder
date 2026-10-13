"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Kache = void 0;
const fs = require("fs");
const path_1 = __importDefault(require("path"));
class Kache {
    cacheStorage;
    cacheName;
    cachePath;
    logger;
    constructor(logger, cacheName) {
        this.logger = logger;
        this.cacheName = cacheName;
        this.cachePath = path_1.default.resolve(process.cwd(), this.cacheName);
        this.cacheStorage = {};
        try {
            const cacheData = fs.readFileSync(this.cachePath);
            this.logger.verbose(`Cache: Using: ${this.cacheName}`);
            this.cacheStorage = JSON.parse(cacheData.toString());
            for (const [key, value] of Object.entries(this.cacheStorage)) {
                const cacheItem = this.cacheStorage[key];
                if (cacheItem.expiration < Date.now()) {
                    this.logger.verbose(`Cache load: '${key}' has expired, deleting`);
                    delete this.cacheStorage[key];
                }
                else {
                    this.logger.verbose(`Cache load: '${key}' still good.`);
                }
            }
        }
        catch (e) {
            this.logger.verbose(`Cache: Creating: ${this.cacheName}`);
        }
    }
    get(key) {
        if (this.cacheStorage[key] !== undefined) {
            const cacheItem = this.cacheStorage[key];
            const expiration = cacheItem.expiration;
            const item = cacheItem.item;
            const now = Date.now();
            if (expiration > now) {
                // object is current
                this.logger.verbose(`Cache: Key: '${key}' - cache hit`);
                return item;
            }
            else {
                // object expired
                this.logger.verbose(`Cache: Key: '${key}' - cache expired`);
            }
        }
        else {
            this.logger.verbose(`Cache: Key: '${key}' - cache miss`);
        }
        return null;
    }
    set(key, newItem, expirationTime) {
        const comment = new Date(expirationTime).toString();
        this.logger.verbose(`Cache set: Key: ${key}, exp: ${comment}`);
        const cacheItem = { expiration: expirationTime, comment: comment, item: newItem };
        this.cacheStorage[key] = cacheItem;
        // Does this need to be synchronous?
        fs.writeFileSync(this.cachePath, JSON.stringify(this.cacheStorage, null, 4));
    }
}
exports.Kache = Kache;
