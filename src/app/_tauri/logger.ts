import {
    warn as tauriWarn,
    debug as tauriDebug,
    trace as tauriTrace,
    info as tauriInfo,
    error as tauriError,
    attachConsole as tauriAttachConsole,
    attachLogger as tauriAttachLogger,
    LogOptions as TauriLogOptions,
} from '@tauri-apps/plugin-log';

export interface LogOptions extends TauriLogOptions{}

export const Logger = {
    warn(message: string, options?: LogOptions): void {tauriWarn(message, options).finally()},
    debug(message: string, options?: LogOptions): void {tauriDebug(message, options).finally()},
    trace(message: string, options?: LogOptions): void {tauriTrace(message, options).finally()},
    info(message: string, options?: LogOptions): void {tauriInfo(message, options).finally()},
    error(message: string, options?: LogOptions): void {tauriError(message, options).finally()}
}
