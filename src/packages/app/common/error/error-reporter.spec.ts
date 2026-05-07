import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildLogMessage, ErrorReporter, formatUnknownError } from "./error-reporter";

vi.mock("@cogno/app-tauri/logger", () => ({
  Logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("error-reporter", () => {
  beforeEach(() => {
    ErrorReporter.setRuntime({
      reportException: vi.fn(),
      reportWarning: vi.fn(),
    });
  });

  it("formats exception and warning log messages", () => {
    expect(
      buildLogMessage({
        error: "boom",
        handled: false,
        source: "unit-test",
        context: { id: 1 },
      }),
    ).toContain("[unit-test] unhandled exception: boom");

    expect(
      buildLogMessage({
        message: "careful",
        source: "unit-test",
        context: { id: 1 },
      }),
    ).toContain("[unit-test] warning: careful");
  });

  it("formats unknown errors from strings, errors and circular values", () => {
    expect(formatUnknownError("simple")).toBe("simple");

    const error = new Error("boom");
    expect(formatUnknownError(error)).toContain("Error: boom");

    const circularValue: Record<string, unknown> = {};
    circularValue["self"] = circularValue;
    expect(formatUnknownError(circularValue)).toContain("[object Object]");
  });

  it("delegates reporting to the active runtime", () => {
    const runtime = {
      reportException: vi.fn(),
      reportWarning: vi.fn(),
    };
    ErrorReporter.setRuntime(runtime);

    ErrorReporter.reportException({ error: "boom", handled: true });
    ErrorReporter.reportWarning({ message: "careful" });

    expect(runtime.reportException).toHaveBeenCalledWith({ error: "boom", handled: true });
    expect(runtime.reportWarning).toHaveBeenCalledWith({ message: "careful" });
  });
});
