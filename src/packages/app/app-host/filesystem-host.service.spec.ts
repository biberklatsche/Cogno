import { Fs } from "@cogno/platform/fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FilesystemHostService } from "./filesystem-host.service";

const shellContext = {
  backendOs: "linux",
  shellType: "Bash",
} as const;

const fs = {
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => ""),
  writeTextFile: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  readDir: vi.fn(async () => []),
  watchChanges$: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `mock-url://${path}`),
} as unknown as Fs;

describe("FilesystemHostService", () => {
  let service: FilesystemHostService;

  beforeEach(() => {
    service = new FilesystemHostService(fs);
  });

  it("normalizes and resolves relative and absolute paths", () => {
    expect(service.normalizePath("/tmp/../workspace", shellContext)).toBe("/workspace");
    expect(service.resolvePath("/workspace", "src/app.ts", shellContext)).toBe(
      "/workspace/src/app.ts",
    );
    expect(service.resolvePath("/workspace", "/tmp/test.ts", shellContext)).toBe("/tmp/test.ts");
  });

  it("preserves unusual path segments when the adapter accepts them", () => {
    expect(service.resolvePath("/workspace", "\0", shellContext)).toBe("/workspace/\0");
  });

  it("lists entries with query prioritization and filtering", async () => {
    vi.mocked(fs.readDir).mockResolvedValue([
      { name: "apple", isDirectory: true, isFile: false },
      { name: "application.log", isDirectory: false, isFile: true },
      { name: "grape", isDirectory: false, isFile: true },
      { name: "unknown", isDirectory: false, isFile: false },
    ]);

    await expect(
      service.list("/workspace", shellContext, {
        query: "app",
        limit: 3,
      }),
    ).resolves.toEqual([
      { name: "apple", path: "/workspace/apple", kind: "directory" },
      { name: "application.log", path: "/workspace/application.log", kind: "file" },
    ]);

    await expect(
      service.list("/workspace", shellContext, {
        directoriesOnly: true,
      }),
    ).resolves.toEqual([{ name: "apple", path: "/workspace/apple", kind: "directory" }]);
  });

  it("returns an empty list when the directory read yields no results", async () => {
    vi.mocked(fs.readDir).mockResolvedValue([]);

    await expect(service.list("/workspace", shellContext)).resolves.toEqual([]);
  });

  it("delegates existence and text file reads to fs", async () => {
    vi.mocked(fs.exists).mockResolvedValue(true);
    vi.mocked(fs.readTextFile).mockResolvedValue("hello");

    await expect(service.exists("/workspace/file.txt", shellContext)).resolves.toBe(true);
    await expect(service.readTextFile("/workspace/file.txt", shellContext)).resolves.toBe("hello");
    await expect(service.readTextFile("", shellContext)).resolves.toBe("hello");
  });
});
