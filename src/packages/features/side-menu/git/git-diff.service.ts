import { Injectable } from "@angular/core";
import { Filesystem, ShellContextContract } from "@cogno/core-api";
import { GitBlobReader } from "./git-blob-reader.port";

export type GitDiffContent = {
  readonly original: string;
  readonly modified: string;
  readonly language: string;
};

/** Truncate files larger than this to avoid passing huge strings to CodeMirror at all. */
const TRUNCATE_THRESHOLD_BYTES = 500_000;

@Injectable({ providedIn: "root" })
export class GitDiffService {
  constructor(
    private readonly gitBlobReader: GitBlobReader,
    private readonly filesystem: Filesystem,
  ) {}

  async loadDiff(
    filePath: string,
    isStaged: boolean,
    isDeletedFile: boolean,
    gitRoot: string,
    shellContext: ShellContextContract,
  ): Promise<GitDiffContent> {
    const language = detectGitDiffLanguage(filePath);
    const absolutePath = this.buildAbsolutePath(gitRoot, filePath);

    // Always read HEAD as original. If the file is genuinely new (doesn't exist
    // in HEAD), git cat-file returns nothing and readBlob resolves to "".
    const original = await this.gitBlobReader.readBlob(gitRoot, `HEAD:${filePath}`);

    let modified = "";
    if (!isDeletedFile) {
      modified = isStaged
        ? await this.gitBlobReader.readBlob(gitRoot, `:0:${filePath}`)
        : await this.filesystem.readTextFile(absolutePath, shellContext).catch(() => "");
    }

    return { original: this.truncate(original), modified: this.truncate(modified), language };
  }

  private truncate(content: string): string {
    if (content.length <= TRUNCATE_THRESHOLD_BYTES) return content;
    return `${content.slice(0, TRUNCATE_THRESHOLD_BYTES)}\n\n[... truncated — file too large ...]`;
  }

  private buildAbsolutePath(gitRoot: string, filePath: string): string {
    // git always uses forward slashes in its output on all platforms;
    // BasePathAdapter.normalize() handles both C:/path and /unix/path forms
    return `${gitRoot}/${filePath}`;
  }
}

export function detectGitDiffLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    cpp: "cpp",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    html: "html",
    css: "css",
    scss: "scss",
    sql: "sql",
  };
  return map[ext] ?? "text";
}
