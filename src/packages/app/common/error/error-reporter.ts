import { Logger } from "@cogno/app-tauri/logger";

export type ErrorReportContext = Readonly<Record<string, unknown>>;

export type ExceptionReport = {
  readonly context?: ErrorReportContext;
  readonly error: unknown;
  readonly handled: boolean;
  readonly notify?: boolean;
  readonly source?: string;
};

export type WarningReport = {
  readonly context?: ErrorReportContext;
  readonly message: string;
  readonly notify?: boolean;
  readonly source?: string;
};

export interface ErrorReporterRuntime {
  reportException(report: ExceptionReport): void;
  reportWarning(report: WarningReport): void;
}

class FallbackErrorReporterRuntime implements ErrorReporterRuntime {
  reportException(report: ExceptionReport): void {
    Logger.error(buildLogMessage(report));
  }

  reportWarning(report: WarningReport): void {
    Logger.warn(buildLogMessage(report));
  }
}

export class ErrorReporter {
  private static runtime: ErrorReporterRuntime = new FallbackErrorReporterRuntime();

  static setRuntime(runtime: ErrorReporterRuntime): void {
    ErrorReporter.runtime = runtime;
  }

  static reportException(report: ExceptionReport): void {
    ErrorReporter.runtime.reportException(report);
  }

  static reportWarning(report: WarningReport): void {
    ErrorReporter.runtime.reportWarning(report);
  }
}

export function buildLogMessage(report: ExceptionReport | WarningReport): string {
  const sourceLabel = report.source ? `[${report.source}] ` : "";

  if ("error" in report) {
    const handlingState = report.handled ? "handled" : "unhandled";
    const errorDetails = formatUnknownError(report.error);
    const contextDetails = formatContext(report.context);
    return `${sourceLabel}${handlingState} exception: ${errorDetails}${contextDetails}`;
  }

  const contextDetails = formatContext(report.context);
  return `${sourceLabel}warning: ${report.message}${contextDetails}`;
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}`;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function formatContext(context: ErrorReportContext | undefined): string {
  if (!context || Object.keys(context).length === 0) {
    return "";
  }

  try {
    return `\nContext: ${JSON.stringify(context)}`;
  } catch {
    return `\nContext: ${String(context)}`;
  }
}
