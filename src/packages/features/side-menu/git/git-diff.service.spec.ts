import { Filesystem, ShellContextContract } from "@cogno/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitBlobReader } from "./git-blob-reader.port";
import { GitDiffService } from "./git-diff.service";

describe("GitDiffService", () => {
  const shellContext: ShellContextContract = { backendOs: "windows", shellType: "Bash" };
  let gitBlobReader: GitBlobReader;
  let filesystem: Filesystem;
  let service: GitDiffService;

  beforeEach(() => {
    gitBlobReader = {
      readBlob: vi.fn().mockResolvedValue("head content"),
    };
    filesystem = {
      normalizePath: vi.fn((path: string) => `/normalized${path}`),
      readTextFile: vi.fn().mockResolvedValue("working tree content"),
    } as unknown as Filesystem;
    service = new GitDiffService(gitBlobReader, filesystem);
  });

  it("normalizes the working tree path before loading unstaged content", async () => {
    const diff = await service.loadDiff("src/file.ts", false, false, "/c/repo", shellContext);

    expect(filesystem.normalizePath).toHaveBeenCalledWith("/c/repo/src/file.ts", shellContext);
    expect(filesystem.readTextFile).toHaveBeenCalledWith(
      "/normalized/c/repo/src/file.ts",
      shellContext,
    );
    expect(diff).toEqual({
      original: "head content",
      modified: "working tree content",
      language: "typescript",
    });
  });

  it("loads staged content from the git index", async () => {
    vi.mocked(gitBlobReader.readBlob)
      .mockResolvedValueOnce("head content")
      .mockResolvedValueOnce("index content");

    const diff = await service.loadDiff("src/file.ts", true, false, "/c/repo", shellContext);

    expect(filesystem.readTextFile).not.toHaveBeenCalled();
    expect(gitBlobReader.readBlob).toHaveBeenNthCalledWith(1, "/c/repo", "HEAD:src/file.ts");
    expect(gitBlobReader.readBlob).toHaveBeenNthCalledWith(2, "/c/repo", ":0:src/file.ts");
    expect(diff.modified).toBe("index content");
  });
});
