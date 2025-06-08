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

export namespace Logger {
    export const warn = (message: string, options?: LogOptions): void => {tauriWarn(message, options).finally()};
    export const debug = (message: string, options?: LogOptions): void => {tauriDebug(message, options).finally()};
    export const trace = (message: string, options?: LogOptions): void => {tauriTrace(message, options).finally()};
    export const info = (message: string, options?: LogOptions): void => {tauriInfo(message, options).finally()};
    export const error = (message: string, options?: LogOptions): void => {tauriError(message, options).finally()};
}
