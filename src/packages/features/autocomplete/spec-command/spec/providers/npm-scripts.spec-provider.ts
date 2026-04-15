import { FilesystemContract } from "@cogno/core-api";
import { SpecProvidedSuggestion, SpecProviderContext, SpecSuggestionProvider } from "../spec.types";

type CacheEntry = {
  expiresAt: number;
  scripts: string[];
};

export class NpmScriptsSpecProvider implements SpecSuggestionProvider {
  readonly id = "npm-scripts";
  private static readonly TTL_MS = 1200;
  private readonly _cache = new Map<string, CacheEntry>();

  constructor(private readonly filesystem: FilesystemContract) {}

  async suggest(context: SpecProviderContext): Promise<ReadonlyArray<SpecProvidedSuggestion>> {
    const cwdNorm = this.filesystem.normalizePath(
      context.queryContext.cwd,
      context.queryContext.shellContext,
    );
    const packageJsonPath = this.filesystem.resolvePath(
      cwdNorm,
      "package.json",
      context.queryContext.shellContext,
    );
    if (!packageJsonPath) return [];

    const cached = this._cache.get(packageJsonPath);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.scripts.map((label) => ({ label }));
    }

    try {
      if (!(await this.filesystem.exists(packageJsonPath, context.queryContext.shellContext)))
        return [];
      const text = await this.filesystem.readTextFile(
        packageJsonPath,
        context.queryContext.shellContext,
      );
      const parsed = JSON.parse(text) as { scripts?: Record<string, string> };
      const scripts = Object.keys(parsed.scripts ?? {});
      this._cache.set(packageJsonPath, {
        expiresAt: now + NpmScriptsSpecProvider.TTL_MS,
        scripts,
      });
      return scripts.map((label) => ({ label }));
    } catch {
      return [];
    }
  }
}
