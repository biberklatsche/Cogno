import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppBus } from "../../app-bus/app-bus";
import { ConfigService } from "../../config/+state/config.service";
import { ErrorReporter } from "./error-reporter";
import { ErrorReportingRuntimeService } from "./error-reporting-runtime.service";

vi.mock("@cogno/app-tauri/logger", () => ({
  Logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("ErrorReportingRuntimeService", () => {
  let appBus: Pick<AppBus, "publish">;
  let configService: ConfigService;
  let service: ErrorReportingRuntimeService;

  beforeEach(() => {
    appBus = {
      publish: vi.fn(),
    };
    configService = {
      get config() {
        return {
          notification: {
            exceptions: {
              handled: { enabled: true },
              unhandled: { enabled: true },
            },
          },
        };
      },
      get config$() {
        throw new Error("not implemented");
      },
      getShellProfileOrDefault: vi.fn(),
      getOrderedShellProfiles: vi.fn(),
      getShellProfileByShortcutIndex: vi.fn(),
      getPromptSegments: vi.fn(),
    };
    service = new ErrorReportingRuntimeService(appBus as AppBus, configService);
  });

  it("publishes notifications for handled exceptions when enabled", () => {
    service.reportException({
      error: new Error("boom"),
      handled: true,
      source: "unit-test",
      context: { attempt: 1 },
    });

    expect(appBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "Notification",
        payload: expect.objectContaining({
          header: "Behandelte Exception",
          source: "unit-test",
          type: "error",
        }),
      }),
    );
  });

  it("suppresses duplicate notifications within the deduplication window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T10:00:00.000Z"));

    service.reportWarning({
      message: "watch out",
      notify: true,
      source: "unit-test",
    });
    service.reportWarning({
      message: "watch out",
      notify: true,
      source: "unit-test",
    });

    expect(appBus.publish).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1001);
    service.reportWarning({
      message: "watch out",
      notify: true,
      source: "unit-test",
    });

    expect(appBus.publish).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("respects config flags and explicit notify overrides", () => {
    configService = {
      get config() {
        return {
          notification: {
            exceptions: {
              handled: { enabled: false },
              unhandled: { enabled: false },
            },
          },
        };
      },
      get config$() {
        throw new Error("not implemented");
      },
      getShellProfileOrDefault: vi.fn(),
      getOrderedShellProfiles: vi.fn(),
      getShellProfileByShortcutIndex: vi.fn(),
      getPromptSegments: vi.fn(),
    };
    service = new ErrorReportingRuntimeService(appBus as AppBus, configService);

    service.reportException({
      error: "ignored",
      handled: false,
      source: "unit-test",
    });
    service.reportWarning({
      message: "hidden",
      notify: false,
      source: "unit-test",
    });

    expect(appBus.publish).not.toHaveBeenCalled();
  });

  it("initializes browser event listeners only once", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    service.initialize();
    service.initialize();

    expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
    expect(addEventListenerSpy).toHaveBeenNthCalledWith(1, "error", expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenNthCalledWith(
      2,
      "unhandledrejection",
      expect.any(Function),
    );
  });

  it("routes browser errors through the shared error reporter", () => {
    let errorListener: ((event: ErrorEvent) => void) | undefined;
    let unhandledRejectionListener: ((event: { reason: unknown }) => void) | undefined;
    vi.spyOn(window, "addEventListener").mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject): void => {
        if (typeof listener !== "function") {
          return;
        }

        if (type === "error") {
          errorListener = listener as (event: ErrorEvent) => void;
        }
        if (type === "unhandledrejection") {
          unhandledRejectionListener = listener as (event: { reason: unknown }) => void;
        }
      },
    );

    service.initialize();
    const reportExceptionSpy = vi.spyOn(ErrorReporter, "reportException");
    const reportWarningSpy = vi.spyOn(ErrorReporter, "reportWarning");

    errorListener?.(
      new ErrorEvent("error", {
        message: "window boom",
        error: new Error("window boom"),
        filename: "file.ts",
        lineno: 10,
        colno: 20,
      }),
    );
    unhandledRejectionListener?.({ reason: "promise failed" });

    expect(reportWarningSpy).not.toHaveBeenCalled();
    expect(reportExceptionSpy).toHaveBeenCalledTimes(2);
  });
});
