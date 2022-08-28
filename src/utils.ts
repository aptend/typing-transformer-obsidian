
interface LogConfig {
    debug: boolean
}

let config: LogConfig;

export function initLog(cfg: LogConfig) {
    config = cfg;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function log(format?: string, ...parts: any[]) {
    if (config != undefined && config.debug) {
        parts.forEach((v, idx) => {
            if (typeof v === 'string' || v instanceof String) {
                parts[idx] = JSON.stringify(v);
            }
        });
        console.log(format, ...parts);
    }
}
