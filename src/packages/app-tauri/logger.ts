import {
  LogOptions as TauriLogOptions,
  attachConsole as tauriAttachConsole,
  debug as tauriDebug,
  error as tauriError,
  info as tauriInfo,
  trace as tauriTrace,
  warn as tauriWarn,
} from "@tauri-apps/plugin-log";

export interface LogOptions extends TauriLogOptions {}

let loggerInitialization: Promise<void> | undefined;

function ignoreRejection<T>(promise: Promise<T>): void {
  promise.catch(() => undefined);
}

function initializeLogger(): Promise<void> {
  if (!loggerInitialization) {
    loggerInitialization = tauriAttachConsole()
      .then(() => undefined)
      .catch(() => undefined);
  }
  return loggerInitialization;
}

export const Logger = {
  initialize(): Promise<void> {
    return initializeLogger();
  },
  warn(message: string, options?: LogOptions): void {
    ignoreRejection(initializeLogger());
    ignoreRejection(tauriWarn(message, options));
  },
  debug(message: string, options?: LogOptions): void {
    ignoreRejection(initializeLogger());
    ignoreRejection(tauriDebug(message, options));
  },
  trace(message: string, options?: LogOptions): void {
    ignoreRejection(initializeLogger());
    ignoreRejection(tauriTrace(message, options));
  },
  info(message: string, options?: LogOptions): void {
    ignoreRejection(initializeLogger());
    ignoreRejection(tauriInfo(message, options));
  },
  error(message: string, options?: LogOptions): void {
    ignoreRejection(initializeLogger());
    ignoreRejection(tauriError(message, options));
  },
};
