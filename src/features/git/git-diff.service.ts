import { Injectable } from "@angular/core";
import { detectGitDiffLanguage, GitDiffLanguageLoader } from "./git-diff-languages";
import { GitRepositoryService } from "./git-repository.service";
import { GitFile } from "./model/git-model";
import { GitPatch, parseGitPatch } from "./model/git-patch";

export type GitDiffContent = {
  readonly original: string;
  readonly modified: string;
  /** How to highlight the file; undefined for plain text. */
  readonly language: GitDiffLanguageLoader | undefined;
};

export type GitConflictContent = {
  /** The working file, empty when it is not there. */
  readonly text: string;
  readonly hasBase: boolean;
  readonly hasOurs: boolean;
  readonly hasTheirs: boolean;
};

/** Where a file's two sides come from, for a diff. */
export type GitTextSource =
  | { readonly kind: "unstaged"; readonly file: GitFile }
  | { readonly kind: "staged"; readonly file: GitFile }
  | {
      readonly kind: "commit";
      readonly file: GitFile;
      readonly sha: string;
      readonly parent: string | null;
    };

/**
 * What the middle of the panel shows for a file: a diff, or for a file git
 * stopped on, the conflict to resolve (which has no two sides to diff).
 */
export type GitDiffSource = GitTextSource | { readonly kind: "conflicted"; readonly file: GitFile };

/** Truncate files larger than this to avoid passing huge strings to CodeMirror at all. */
const TRUNCATE_THRESHOLD_BYTES = 500_000;
const BLOB_TIMEOUT_MS = 10_000;

@Injectable({ providedIn: "root" })
export class GitDiffService {
  constructor(private readonly repository: GitRepositoryService) {}

  /**
   * Both sides of a file, as git sees the change: unstaged is index against
   * working tree, staged is HEAD against index, a commit is its first parent
   * against the commit. A side the file does not exist on is empty.
   */
  async loadDiff(source: GitTextSource): Promise<GitDiffContent> {
    const { file } = source;
    const language = detectGitDiffLanguage(file.path);
    const before = file.oldPath ?? file.path;
    const added = file.status === "A" || file.status === "?";
    const deleted = file.status === "D";

    let original = "";
    let modified = "";
    if (source.kind === "unstaged") {
      original = added ? "" : await this.readBlob(`:0:${before}`);
      modified = deleted ? "" : await this.readWorkingText(file.path);
    } else if (source.kind === "staged") {
      original = file.status === "A" ? "" : await this.readBlob(`HEAD:${before}`);
      modified = deleted ? "" : await this.readBlob(`:0:${file.path}`);
    } else {
      original = added || !source.parent ? "" : await this.readBlob(`${source.parent}:${before}`);
      modified = deleted ? "" : await this.readBlob(`${source.sha}:${file.path}`);
    }

    return { original: truncate(original), modified: truncate(modified), language };
  }

  /**
   * The same change as git's own patch, hunk by hunk. An untracked file has
   * none: git knows no previous version to diff against.
   */
  async loadPatch(source: GitTextSource): Promise<GitPatch> {
    const { file } = source;
    if (file.status === "?") return { header: [], hunks: [], binary: false };
    const args =
      source.kind === "commit"
        ? [...(source.parent ? [source.parent] : ["--root"]), source.sha]
        : source.kind === "staged"
          ? ["--cached"]
          : [];
    const paths = file.oldPath ? [file.oldPath, file.path] : [file.path];
    const result = await this.repository.run(
      ["diff", "--no-color", "--no-ext-diff", "--find-renames", ...args, "--", ...paths],
      BLOB_TIMEOUT_MS,
    );
    return parseGitPatch(result?.exitCode === 0 ? result.stdout : "");
  }

  /**
   * A conflicted file as the working tree has it, with its conflict markers,
   * and which sides still have a version of it (one may have deleted it).
   */
  async loadConflict(path: string): Promise<GitConflictContent> {
    const [text, stages] = await Promise.all([
      this.readWorkingText(path),
      this.repository.loadConflictStages(path),
    ]);
    return { text, hasBase: stages.has(1), hasOurs: stages.has(2), hasTheirs: stages.has(3) };
  }

  /** A git object read in the bound session; empty when it does not exist. */
  private async readBlob(revision: string): Promise<string> {
    const result = await this.repository.run(["cat-file", "-p", revision], BLOB_TIMEOUT_MS);
    return result?.exitCode === 0 ? result.stdout : "";
  }

  /** A file as the working tree has it; empty when it is not there. */
  async readWorkingText(path: string): Promise<string> {
    const session = this.repository.currentSession();
    const root = this.repository.root();
    if (!session || !root) return "";
    // git prints forward slashes on every platform; normalizePath handles both forms.
    return session.fs.readTextFile(session.fs.normalizePath(`${root}/${path}`)).catch(() => "");
  }
}

function truncate(content: string): string {
  if (content.length <= TRUNCATE_THRESHOLD_BYTES) return content;
  return `${content.slice(0, TRUNCATE_THRESHOLD_BYTES)}\n\n[... truncated — file too large ...]`;
}
