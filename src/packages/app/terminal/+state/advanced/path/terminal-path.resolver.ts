import { IPathAdapter } from "@cogno/core-api";

export class TerminalPathResolver {
  resolvePathForOpen(
    candidate: string,
    cwd: string | undefined,
    pathAdapter: IPathAdapter | undefined,
  ): string | undefined {
    if (!pathAdapter) return undefined;

    const unquoted = this.stripOuterQuotes(candidate.trim());
    if (!unquoted) return undefined;

    if (this.isAbsolutePathCandidate(unquoted)) {
      return this.toBackendFsPath(pathAdapter, unquoted);
    }

    if (!this.isRelativePathCandidate(unquoted)) {
      return undefined;
    }

    if (!cwd) return undefined;

    const normalizedCwd = this.safeNormalize(pathAdapter, cwd);
    if (!normalizedCwd) return undefined;

    const combined = this.joinCognoPath(normalizedCwd, unquoted);
    return pathAdapter.render(combined, { purpose: "backend_fs" });
  }

  private toBackendFsPath(pathAdapter: IPathAdapter, pathLike: string): string | undefined {
    const normalized = this.safeNormalize(pathAdapter, pathLike);
    if (!normalized) return undefined;
    return pathAdapter.render(normalized, { purpose: "backend_fs" });
  }

  private safeNormalize(pathAdapter: IPathAdapter, pathLike: string): string | undefined {
    try {
      return pathAdapter.normalize(pathLike);
    } catch {
      return undefined;
    }
  }

  private stripOuterQuotes(s: string): string {
    if (s.length < 2) return s;
    const starts = s[0];
    const ends = s[s.length - 1];
    if (
      (starts === "'" && ends === "'") ||
      (starts === '"' && ends === '"') ||
      (starts === "`" && ends === "`")
    ) {
      return s.slice(1, -1);
    }
    return s;
  }

  private isAbsolutePathCandidate(s: string): boolean {
    return (
      /^[A-Za-z]:(?:[\\/]|$)/.test(s) ||
      /^(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+/.test(s) ||
      /^\/(?!\/?$)/.test(s)
    );
  }

  private isRelativePathCandidate(s: string): boolean {
    if (/^\.\.?(?:[\\/]|$)/.test(s)) return true;
    if (!/[\\/]/.test(s)) return false;
    if (/^~(?:[\\/]|$)/.test(s)) return true;
    if (/^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/|\\\\|\/)/.test(s)) return false;
    return true;
  }

  private joinCognoPath(baseCognoPath: string, relativePath: string): string {
    const base = baseCognoPath.replace(/\\/g, "/");
    const rel = relativePath.replace(/\\/g, "/");
    const raw = `${base.replace(/\/+$/, "")}/${rel}`;
    const keepDouble = raw.startsWith("//");
    const parts = raw.split("/");
    const out: string[] = [];
    for (const segment of parts) {
      if (!segment || segment === ".") continue;
      if (segment === "..") {
        if (out.length > 0) out.pop();
        continue;
      }
      out.push(segment);
    }
    return `${keepDouble ? "//" : "/"}${out.join("/")}`;
  }
}
