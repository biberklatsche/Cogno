import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { Fs } from "@cogno/platform/fs";
import { Logger } from "@cogno/platform/logger";
import { Shells } from "@cogno/platform/shells";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShellIntegrationWriter } from "./shell-integration.writer";

const fs = {
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => ""),
  writeTextFile: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  readDir: vi.fn(async () => []),
  watchChanges$: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `mock-url://${path}`),
} as unknown as Fs;

const environmentStub = { configDir: () => "/tmp/cogno" } as never;
const shellsStub = { load: vi.fn(async () => []) } as unknown as Shells;
const writer = new ShellIntegrationWriter(shellsStub, environmentStub, fs);

describe("ShellIntegrationWriter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the configured integration root", async () => {
    await expect(writer.getIntegrationRoot()).resolves.toBe("/tmp/cogno/shell-integration");
  });

  it("skips installation when the version is already current", async () => {
    vi.mocked(fs.exists).mockResolvedValue(true);
    vi.mocked(fs.readTextFile).mockResolvedValue("1.3.0");
    const mkdirSpy = vi.mocked(fs.mkdir);

    await writer.ensure([]);

    expect(mkdirSpy).not.toHaveBeenCalled();
  });

  it("creates directories, writes merged integration files and updates version logs", async () => {
    const existingPaths = new Set<string>([
      "/tmp/cogno/shell-integration/VERSION",
      "/tmp/cogno/shell-integration/logs/updates.log",
    ]);

    vi.mocked(fs.exists).mockImplementation(async (path: string) => existingPaths.has(path));
    vi.mocked(fs.readTextFile).mockImplementation(async (path: string) => {
      if (path.endsWith("/VERSION")) {
        return "1.0.0";
      }
      if (path.endsWith("/updates.log")) {
        return "existing log\n";
      }
      return "";
    });
    const mkdirSpy = vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    const writeTextFileSpy = vi.mocked(fs.writeTextFile).mockResolvedValue(undefined);
    const loggerSpy = vi.spyOn(Logger, "info").mockImplementation(() => undefined);
    vi.mocked(shellsStub.load).mockResolvedValue([
      { shell_type: "Bash" },
      { shell_type: "Zsh" },
      { shell_type: "ZSH" },
    ] as never);

    await writer.ensure([
      {
        shellType: "Bash",
        integrationFiles: [
          { relativePath: "bash/base.sh", content: "base" },
          { relativePath: "shared/env.sh", content: "bash shared" },
        ],
      },
      {
        shellType: "Zsh",
        integrationTemplateShellType: "Bash",
        integrationFiles: [
          { relativePath: "zsh/entry.zsh", content: "entry" },
          { relativePath: "shared/env.sh", content: "zsh shared" },
        ],
      },
    ]);

    expect(mkdirSpy).toHaveBeenCalledWith("/tmp/cogno/shell-integration", { recursive: true });
    expect(mkdirSpy).toHaveBeenCalledWith("/tmp/cogno/shell-integration/logs", { recursive: true });
    expect(writeTextFileSpy).toHaveBeenCalledWith(
      "/tmp/cogno/shell-integration/bash/base.sh",
      "base",
    );
    expect(writeTextFileSpy).toHaveBeenCalledWith(
      "/tmp/cogno/shell-integration/shared/env.sh",
      "bash shared",
    );
    expect(writeTextFileSpy).toHaveBeenCalledWith(
      "/tmp/cogno/shell-integration/zsh/entry.zsh",
      "entry",
    );
    expect(writeTextFileSpy).toHaveBeenCalledWith("/tmp/cogno/shell-integration/VERSION", "1.3.0");
    expect(writeTextFileSpy).toHaveBeenCalledWith(
      "/tmp/cogno/shell-integration/logs/updates.log",
      expect.stringContaining("Updated shell integration to version 1.3.0"),
    );
    expect(loggerSpy).toHaveBeenCalledWith("Installing/updating shell integration scripts...");
  });

  it("reports and rethrows installation errors", async () => {
    const installError = new Error("shell discovery failed");
    vi.mocked(fs.exists).mockResolvedValue(false);
    vi.mocked(shellsStub.load).mockRejectedValue(installError);
    const reportExceptionSpy = vi
      .spyOn(ErrorReporter, "reportException")
      .mockImplementation(() => undefined);

    await expect(writer.ensure([])).rejects.toThrow("shell discovery failed");

    expect(reportExceptionSpy).toHaveBeenCalledWith({
      error: installError,
      handled: true,
      source: "ShellIntegrationWriter",
      context: {
        operation: "ensure",
      },
    });
  });
});
