import { Injectable } from "@angular/core";
import { AppBus } from "@cogno/app/app-bus/app-bus";
import { ConfigService } from "@cogno/app/config/+state/config.service";
import {
  ErrorReporter,
  ErrorReporterRuntime,
  ExceptionReport,
  WarningReport,
  buildLogMessage,
  formatUnknownError,
} from "./error-reporter";
import { Logger } from "@cogno/app-tauri/logger";

const DEDUPLICATION_WINDOW_MS = 1000;
const MAX_NOTIFICATION_BODY_LENGTH = 2000;

@Injectable({ providedIn: "root" })
export class ErrorReportingRuntimeService implements ErrorReporterRuntime {
  private readonly recentFingerprintTimestamps = new Map<string, number>();
  private isInitialized = false;

  constructor(
    private readonly appBus: AppBus,
    private readonly configService: ConfigService,
  ) {}

  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;
    ErrorReporter.setRuntime(this);
    window.addEventListener("error", this.handleWindowErrorEvent);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejectionEvent);
  }

  reportException(report: ExceptionReport): void {
    try {
      const fingerprint = this.buildFingerprint(report);
      if (this.shouldSuppressDuplicate(fingerprint)) {
        return;
      }

      Logger.error(buildLogMessage(report));

      if (!this.shouldNotifyForException(report)) {
        return;
      }

      this.appBus.publish({
        type: "Notification",
        path: ["notification"],
        payload: {
          body: this.buildNotificationBody(report),
          header: report.handled ? "Behandelte Exception" : "Unbehandelte Exception",
          source: report.source ?? "ErrorReporting",
          timestamp: new Date(),
          type: "error",
        },
      });
    } catch (error) {
      Logger.error(`[ErrorReportingRuntimeService] Failed to report exception: ${formatUnknownError(error)}`);
    }
  }

  reportWarning(report: WarningReport): void {
    try {
      const fingerprint = this.buildFingerprint(report);
      if (this.shouldSuppressDuplicate(fingerprint)) {
        return;
      }

      Logger.warn(buildLogMessage(report));

      if (!report.notify) {
        return;
      }

      this.appBus.publish({
        type: "Notification",
        path: ["notification"],
        payload: {
          body: this.limitTextLength(report.message),
          header: "Warnung",
          source: report.source ?? "ErrorReporting",
          timestamp: new Date(),
          type: "warning",
        },
      });
    } catch (error) {
      Logger.error(`[ErrorReportingRuntimeService] Failed to report warning: ${formatUnknownError(error)}`);
    }
  }

  private readonly handleWindowErrorEvent = (event: ErrorEvent): void => {
    ErrorReporter.reportException({
      context: {
        columnNumber: event.colno,
        fileName: event.filename,
        lineNumber: event.lineno,
      },
      error: event.error ?? event.message,
      handled: false,
      source: "window.onerror",
    });
  };

  private readonly handleUnhandledRejectionEvent = (event: PromiseRejectionEvent): void => {
    ErrorReporter.reportException({
      error: event.reason,
      handled: false,
      source: "window.onunhandledrejection",
    });
  };

  private shouldNotifyForException(report: ExceptionReport): boolean {
    if (report.notify === false) {
      return false;
    }

    const notificationConfig = this.readExceptionNotificationConfiguration();
    return report.handled
      ? notificationConfig.handledEnabled
      : notificationConfig.unhandledEnabled;
  }

  private readExceptionNotificationConfiguration(): {
    readonly handledEnabled: boolean;
    readonly unhandledEnabled: boolean;
  } {
    try {
      const exceptionsConfiguration =
        this.configService.config.notification?.exceptions;

      return {
        handledEnabled: exceptionsConfiguration?.handled?.enabled ?? false,
        unhandledEnabled: exceptionsConfiguration?.unhandled?.enabled ?? false,
      };
    } catch {
      return {
        handledEnabled: false,
        unhandledEnabled: false,
      };
    }
  }

  private buildNotificationBody(report: ExceptionReport): string {
    const bodyParts: string[] = [];
    const errorDetails = formatUnknownError(report.error);
    bodyParts.push(this.limitTextLength(errorDetails));

    if (report.source) {
      bodyParts.push(`Quelle: ${report.source}`);
    }

    if (report.context && Object.keys(report.context).length > 0) {
      try {
        bodyParts.push(`Kontext: ${JSON.stringify(report.context)}`);
      } catch {
        bodyParts.push(`Kontext: ${String(report.context)}`);
      }
    }

    return this.limitTextLength(bodyParts.join("\n"));
  }

  private limitTextLength(text: string): string {
    if (text.length <= MAX_NOTIFICATION_BODY_LENGTH) {
      return text;
    }

    return `${text.slice(0, MAX_NOTIFICATION_BODY_LENGTH - 1)}…`;
  }

  private buildFingerprint(report: ExceptionReport | WarningReport): string {
    const serializedContext = report.context ? safeSerialize(report.context) : "";

    if ("error" in report) {
      return [
        "exception",
        report.handled ? "handled" : "unhandled",
        report.source ?? "",
        formatUnknownError(report.error),
        serializedContext,
      ].join("|");
    }

    return [
      "warning",
      report.source ?? "",
      report.message,
      serializedContext,
    ].join("|");
  }

  private shouldSuppressDuplicate(fingerprint: string): boolean {
    const now = Date.now();
    const lastTimestamp = this.recentFingerprintTimestamps.get(fingerprint);
    this.recentFingerprintTimestamps.set(fingerprint, now);

    for (const [storedFingerprint, storedTimestamp] of this.recentFingerprintTimestamps.entries()) {
      if (now - storedTimestamp > DEDUPLICATION_WINDOW_MS) {
        this.recentFingerprintTimestamps.delete(storedFingerprint);
      }
    }

    return lastTimestamp !== undefined && now - lastTimestamp <= DEDUPLICATION_WINDOW_MS;
  }
}

function safeSerialize(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}


