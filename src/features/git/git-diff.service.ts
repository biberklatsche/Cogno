import { Injectable } from "@angular/core";
import { GitRepositoryService } from "./git-repository.service";
import { GitFile } from "./model/git-model";
import { GitPatch, parseGitPatch } from "./model/git-patch";

export type GitDiffContent = {
  readonly original: string;
  readonly modified: string;
  readonly language: string;
};

/** Where a file's two sides come from. */
export type GitDiffSource =
  | { readonly kind: "unstaged"; readonly file: GitFile }
  | { readonly kind: "staged"; readonly file: GitFile }
  | {
      readonly kind: "commit";
      readonly file: GitFile;
      readonly sha: string;
      readonly parent: string | null;
    };

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
  async loadDiff(source: GitDiffSource): Promise<GitDiffContent> {
    const { file } = source;
    const language = detectGitDiffLanguage(file.path);
    const before = file.oldPath ?? file.path;
    const added = file.status === "A" || file.status === "?";
    const deleted = file.status === "D";

    let original = "";
    let modified = "";
    if (source.kind === "unstaged") {
      // A conflicted file has no single index entry; it is compared with HEAD.
      const base = file.status === "U" ? `HEAD:${before}` : `:0:${before}`;
      original = added ? "" : await this.readBlob(base);
      modified = deleted ? "" : await this.readWorkingFile(file.path);
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
  async loadPatch(source: GitDiffSource): Promise<GitPatch> {
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

  /** A git object read in the bound session; empty when it does not exist. */
  private async readBlob(revision: string): Promise<string> {
    const result = await this.repository.run(["cat-file", "-p", revision], BLOB_TIMEOUT_MS);
    return result?.exitCode === 0 ? result.stdout : "";
  }

  private async readWorkingFile(path: string): Promise<string> {
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

function detectGitDiffLanguage(filePath: string): string {
  const filename = (filePath.split("/").pop() ?? filePath).toLowerCase();

  const filenameMap: Record<string, string> = {
    dockerfile: "dockerfile",
    "nginx.conf": "nginx",
    gemfile: "ruby",
    rakefile: "ruby",
    vagrantfile: "ruby",
    ".bashrc": "shell",
    ".zshrc": "shell",
    ".bash_profile": "shell",
    ".zprofile": "shell",
    ".profile": "shell",
  };
  if (filenameMap[filename]) return filenameMap[filename];

  const ext = filename.split(".").pop() ?? "";
  const map: Record<string, string> = {
    // TypeScript / JavaScript
    ts: "typescript",
    tsx: "typescript",
    mts: "typescript",
    cts: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    // Web
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "css",
    vue: "vue",
    xml: "xml",
    svg: "xml",
    xhtml: "xml",
    xsd: "xml",
    // Data / Config
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    sql: "sql",
    // Docs
    md: "markdown",
    mdx: "markdown",
    // Systems
    rs: "rust",
    go: "go",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    c: "cpp",
    h: "cpp",
    hpp: "cpp",
    hxx: "cpp",
    cs: "csharp",
    java: "java",
    kt: "kotlin",
    kts: "kotlin",
    scala: "scala",
    sc: "scala",
    swift: "swift",
    m: "objectivec",
    mm: "objectivecpp",
    // Scripting
    py: "python",
    rb: "ruby",
    rake: "ruby",
    gemspec: "ruby",
    lua: "lua",
    pl: "perl",
    pm: "perl",
    php: "php",
    phtml: "php",
    // Shell
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    ps1: "powershell",
    psm1: "powershell",
    psd1: "powershell",
    // Functional / Other
    hs: "haskell",
    lhs: "haskell",
    dart: "dart",
    r: "r",
    jl: "julia",
    elm: "elm",
    clj: "clojure",
    cljs: "clojure",
    cljc: "clojure",
    erl: "erlang",
    hrl: "erlang",
    ml: "ocaml",
    mli: "ocaml",
    groovy: "groovy",
    gradle: "groovy",
    coffee: "coffeescript",
    cr: "crystal",
    proto: "protobuf",
  };
  return map[ext] ?? "text";
}
