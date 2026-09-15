import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BoundSessionHandle, SessionApi } from "@cogno/core/api/session-api";

export type GitDiffContent = {
  readonly original: string;
  readonly modified: string;
  readonly language: string;
};

/** Truncate files larger than this to avoid passing huge strings to CodeMirror at all. */
const TRUNCATE_THRESHOLD_BYTES = 500_000;
const BLOB_TIMEOUT_MS = 10_000;

@Injectable({ providedIn: "root" })
export class GitDiffService {
  private boundSession: BoundSessionHandle | null = null;

  constructor(sessionApi: SessionApi, destroyRef: DestroyRef) {
    sessionApi.boundSession$.pipe(takeUntilDestroyed(destroyRef)).subscribe((boundSession) => {
      this.boundSession = boundSession.status === "active" ? boundSession.session : null;
    });
  }

  async loadDiff(
    filePath: string,
    isStaged: boolean,
    isDeletedFile: boolean,
    gitRoot: string,
  ): Promise<GitDiffContent> {
    const language = detectGitDiffLanguage(filePath);
    const session = this.boundSession;
    if (!session) {
      return { original: "", modified: "", language };
    }
    const absolutePath = session.fs.normalizePath(this.buildAbsolutePath(gitRoot, filePath));

    // Always read HEAD as original. If the file is genuinely new (missing in
    // HEAD), `git cat-file` fails and the blob read resolves to "".
    const original = await this.readBlob(session, gitRoot, `HEAD:${filePath}`);

    let modified = "";
    if (!isDeletedFile) {
      modified = isStaged
        ? await this.readBlob(session, gitRoot, `:0:${filePath}`)
        : await session.fs.readTextFile(absolutePath).catch(() => "");
    }

    return { original: this.truncate(original), modified: this.truncate(modified), language };
  }

  /**
   * Read a git object through the bound session, so it is correct in a WSL or
   * remote context; empty string when the object does not exist or is rejected.
   */
  private async readBlob(
    session: BoundSessionHandle,
    gitRoot: string,
    revision: string,
  ): Promise<string> {
    const outcome = await session.run({
      executable: "git",
      args: ["-C", gitRoot, "cat-file", "-p", revision],
      contextRevision: session.contextRevision,
      timeoutMs: BLOB_TIMEOUT_MS,
    });
    if (outcome.status !== "ran" || outcome.result.exitCode !== 0) {
      return "";
    }
    return outcome.result.stdout;
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
