import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorReportingRuntimeService } from "./error-reporting-runtime.service";

vi.mock("@cogno/platform/logger", () => ({
  Logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("ErrorReportingRuntimeService", () => {
  let appBus: Pick<AppBus, "publish">;
  let service: ErrorReportingRuntimeService;

  beforeEach(() => {
    appBus = {
      publish: vi.fn(),
    };
    service = new ErrorReportingRuntimeService(appBus as AppBus);
  });

  it("publishes handled exceptions with their event; the dispatch decides whether they show", () => {
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
          event: { source: "errors", id: "handled" },
          header: "Handled exception",
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

  it("stays quiet when the caller asks for no notification", () => {
    service.reportException({
      error: "ignored",
      handled: false,
      notify: false,
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
          unhandledRejectionListener = listener as unknown as (event: { reason: unknown }) => void;
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
