export interface Logger {
    info: (...args: any[]) => void;
    verbose: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
}
