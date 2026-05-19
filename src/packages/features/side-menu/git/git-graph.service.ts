import { Injectable, signal } from "@angular/core";
import { CommandRunner, ShellContextContract } from "@cogno/core-api";

export type GitRefKind = "local" | "remote" | "tag" | "stash";

export type CommitFileStatus = "M" | "A" | "D" | "R";

export type CommitFile = {
  readonly path: string;
  readonly status: CommitFileStatus;
  readonly originalPath?: string;
};

export type GitRefInfo = {
  name: string; // short display name (branch without remote prefix, or tag name)
  fullName: string; // "main" for local, "origin/main" for remote, "v1.0" for tag
  kind: GitRefKind;
  remoteName?: string;
};

export type GitCommitNode = {
  hash: string;
  parents: string[];
  refs: GitRefInfo[];
  isHEAD: boolean;
  isStash: boolean;
  author: string;
  date: string;
  subject: string;
};

@Injectable({ providedIn: "root" })
export class GitGraphService {
  private static readonly PAGE_SIZE = 200;

  private readonly commitsSignal = signal<GitCommitNode[] | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly hasMoreSignal = signal(false);

  readonly commits = this.commitsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly hasMore = this.hasMoreSignal.asReadonly();

  private rawFetchedCount = 0;
  private lastGitRoot = "";
  private lastShellContext: ShellContextContract | null = null;

  constructor(private readonly commandRunner: CommandRunner) {}

  async load(gitRoot: string, shellContext: ShellContextContract): Promise<void> {
    this.lastGitRoot = gitRoot;
    this.lastShellContext = shellContext;
    this.rawFetchedCount = 0;
    this.loadingSignal.set(true);
    try {
      const result = await this.commandRunner.run({
        cwd: gitRoot,
        shellContext,
        program: "git",
        args: this.buildArgs(0),
        timeoutMs: 10_000,
      });
      if (result.exitCode !== 0) {
        this.commitsSignal.set(null);
        this.hasMoreSignal.set(false);
        return;
      }
      const all = parseGitLog(result.stdout);
      this.rawFetchedCount = all.length;
      this.hasMoreSignal.set(all.length === GitGraphService.PAGE_SIZE);
      this.commitsSignal.set(this.filterAux(all));
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (this.loadingSignal() || !this.hasMoreSignal() || !this.lastShellContext) return;
    this.loadingSignal.set(true);
    try {
      const result = await this.commandRunner.run({
        cwd: this.lastGitRoot,
        shellContext: this.lastShellContext,
        program: "git",
        args: this.buildArgs(this.rawFetchedCount),
        timeoutMs: 10_000,
      });
      if (result.exitCode !== 0) return;
      const all = parseGitLog(result.stdout);
      this.rawFetchedCount += all.length;
      this.hasMoreSignal.set(all.length === GitGraphService.PAGE_SIZE);
      this.commitsSignal.update((existing) => [...(existing ?? []), ...this.filterAux(all)]);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private buildArgs(skip: number): string[] {
    const args = [
      "log",
      "--all",
      "--date-order",
      "--parents",
      "--decorate=full",
      "--pretty=format:%H|%P|%D|%an|%ad|%s",
      "--date=format:%d.%m.%Y %H:%M",
      "-n",
      `${GitGraphService.PAGE_SIZE}`,
    ];
    if (skip > 0) args.push("--skip", `${skip}`);
    return args;
  }

  private filterAux(commits: GitCommitNode[]): GitCommitNode[] {
    const aux = new Set(
      commits
        .filter((c) => /^(index on |untracked files on )/.test(c.subject))
        .map((c) => c.hash),
    );
    return commits.filter((c) => !aux.has(c.hash));
  }

  async loadCommitFiles(
    hash: string,
    gitRoot: string,
    shellContext: ShellContextContract,
  ): Promise<CommitFile[]> {
    const result = await this.commandRunner.run({
      cwd: gitRoot,
      shellContext,
      program: "git",
      args: ["show", "--name-status", "--pretty=format:", hash],
      timeoutMs: 10_000,
    });
    if (result.exitCode !== 0) return [];
    return parseCommitFiles(result.stdout);
  }

  clear(): void {
    this.commitsSignal.set(null);
    this.hasMoreSignal.set(false);
    this.rawFetchedCount = 0;
    this.lastShellContext = null;
  }
}

function parseRef(raw: string): GitRefInfo | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("refs/heads/")) {
    const name = s.slice("refs/heads/".length);
    return { name, fullName: name, kind: "local" };
  }
  if (s.startsWith("refs/remotes/")) {
    const rest = s.slice("refs/remotes/".length);
    const slash = rest.indexOf("/");
    if (slash === -1) return null;
    const remoteName = rest.slice(0, slash);
    const branchName = rest.slice(slash + 1);
    if (branchName === "HEAD") return null;
    return {
      name: branchName,
      fullName: `${remoteName}/${branchName}`,
      kind: "remote",
      remoteName,
    };
  }
  if (s.startsWith("refs/tags/")) {
    const name = s.slice("refs/tags/".length);
    return { name, fullName: name, kind: "tag" };
  }
  if (s === "refs/stash") {
    return { name: "stash", fullName: "refs/stash", kind: "stash" };
  }
  return null;
}

function parseCommitFiles(output: string): CommitFile[] {
  return output
    .split("\n")
    .filter(Boolean)
    .flatMap((line): CommitFile[] => {
      const parts = line.split("\t");
      const rawStatus = parts[0]?.trim() ?? "";
      if (!rawStatus) return [];
      if (rawStatus.startsWith("R")) {
        const originalPath = parts[1]?.trim() ?? "";
        const path = parts[2]?.trim() ?? "";
        return path ? [{ path, status: "R", originalPath }] : [];
      }
      const status = rawStatus as CommitFileStatus;
      const path = parts[1]?.trim() ?? "";
      return path && (status === "M" || status === "A" || status === "D") ? [{ path, status }] : [];
    });
}

export function parseGitLog(raw: string): GitCommitNode[] {
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|");
      const hash = parts[0]?.trim() ?? "";
      const parents = parts[1]?.trim() ? parts[1].trim().split(" ").filter(Boolean) : [];
      const rawRefs = parts[2]?.trim()
        ? parts[2]
            .trim()
            .split(", ")
            .map((r) => r.trim())
            .filter(Boolean)
        : [];
      const author = parts[3]?.trim() ?? "";
      const date = parts[4]?.trim() ?? "";
      const subject = parts.slice(5).join("|").trim();

      const isHEAD = rawRefs.some((r) => r.startsWith("HEAD ->") || r === "HEAD");
      const refs = rawRefs
        .map((r) => r.replace(/^HEAD\s*->\s*/, "").trim())
        .map(parseRef)
        .filter((r): r is GitRefInfo => r !== null);

      const isStash = refs.some((r) => r.kind === "stash");

      return { hash, parents, refs, isHEAD, isStash, author, date, subject };
    });
}
