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
    const absolutePath = this.filesystem.normalizePath(
      this.buildAbsolutePath(gitRoot, filePath),
      shellContext,
    );

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

  async loadCommitFileDiff(
    hash: string,
    filePath: string,
    originalPath: string,
    isDeletedFile: boolean,
    gitRoot: string,
  ): Promise<GitDiffContent> {
    const language = detectGitDiffLanguage(filePath);
    const original = await this.gitBlobReader.readBlob(gitRoot, `${hash}^:${originalPath}`);
    const modified = isDeletedFile
      ? ""
      : await this.gitBlobReader.readBlob(gitRoot, `${hash}:${filePath}`);
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
