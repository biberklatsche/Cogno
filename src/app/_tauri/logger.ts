import {
    warn as tauriWarn,
    debug as tauriDebug,
    trace as tauriTrace,
    info as tauriInfo,
    error as tauriError,
    attachConsole as tauriAttachConsole,
    attachLogger as tauriAttachLogger,
    LogOptions as TauriLogOptions, LogLevel,
} from '@tauri-apps/plugin-log';

tauriAttachConsole();
tauriAttachLogger((l) => {
    switch (l.level) {
        case LogLevel.Info: console.info(l.message); break;
        case LogLevel.Debug: console.debug(l.message); break;
        case LogLevel.Warn: console.warn(l.message); break;
        case LogLevel.Trace: console.trace(l.message); break;
        case LogLevel.Error: console.error(l.message); break;
    }
});

export interface LogOptions extends TauriLogOptions{}

export const Logger = {
    warn(message: string, options?: LogOptions): void {tauriWarn(message, options).finally()},
    debug(message: string, options?: LogOptions): void {tauriDebug(message, options).finally()},
    trace(message: string, options?: LogOptions): void {tauriTrace(message, options).finally()},
    info(message: string, options?: LogOptions): void {tauriInfo(message, options).finally()},
    error(message: string, options?: LogOptions): void {tauriError(message, options).finally()}
}
