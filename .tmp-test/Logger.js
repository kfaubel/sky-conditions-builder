"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
class Logger {
    module;
    level = 2;
    _VERBOSE = 0;
    _DEBUG = 1;
    _INFO = 2;
    _WARN = 3;
    _ERROR = 4;
    constructor(module, levelStr = "info") {
        this.module = module;
        switch (levelStr) {
            case "error":
                this.level = this._ERROR;
                break;
            case "warn":
                this.level = this._WARN;
                break;
            case "info":
                this.level = this._INFO;
                break;
            case "debug":
                this.level = this._DEBUG;
                break;
            case "verbose":
                this.level = this._VERBOSE;
                break;
            case "trace":
                this.level = this._VERBOSE;
                break;
            default: console.log(`Unexpected level: ${levelStr}, using warn`);
        }
    }
    error(text) {
        if (this.level <= this._ERROR) {
            console.error(`[${this.module} E] ${text}`);
        }
    }
    warn(text) {
        if (this.level <= this._WARN) {
            console.log(`[${this.module} W] ${text}`);
        }
    }
    log(text) {
        if (this.level <= this._INFO) {
            console.log(`[${this.module} I] ${text}`);
        }
    }
    info(text) {
        if (this.level <= this._INFO) {
            console.log(`[${this.module} I] ${text}`);
        }
    }
    verbose(text) {
        if (this.level <= this._VERBOSE) {
            console.log(`[${this.module} V] ${text}`);
        }
    }
    trace(text) {
        if (this.level <= this._VERBOSE)
            return;
        console.debug(`[${this.module} V] ${text}`);
    }
}
exports.Logger = Logger;
