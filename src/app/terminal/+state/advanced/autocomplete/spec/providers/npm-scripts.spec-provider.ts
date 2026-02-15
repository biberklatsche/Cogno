import { Fs } from "../../../../../../_tauri/fs";
import { Logger } from "../../../../../../_tauri/logger";
import { PathFactory } from "../../../adapter/path.factory";
import { AutocompletePathUtil } from "../../autocomplete-path.util";
import { SpecProviderContext, SpecSuggestionProvider } from "../spec.types";

type CacheEntry = {
    expiresAt: number;
    scripts: string[];
};

export class NpmScriptsSpecProvider implements SpecSuggestionProvider {
    readonly id = "npm-scripts";
    private static readonly TTL_MS = 1200;
    private readonly _cache = new Map<string, CacheEntry>();

    async suggest(context: SpecProviderContext): Promise<string[]> {
        const adapter = PathFactory.createAdapter(context.queryContext.shellContext);
        const cwdNorm = AutocompletePathUtil.normalizeCwd(context.queryContext.cwd, context.queryContext.shellContext);
        const cwdBackend = adapter.render(cwdNorm, { purpose: "backend_fs" });
        if (!cwdBackend) return [];

        const cached = this._cache.get(cwdBackend);
        const now = Date.now();
        if (cached && cached.expiresAt > now) {
            return cached.scripts;
        }

        const sep = cwdBackend.includes("\\") ? "\\" : "/";
        const packageJsonPath = cwdBackend.endsWith(sep) ? `${cwdBackend}package.json` : `${cwdBackend}${sep}package.json`;

        try {
            if (!(await Fs.exists(packageJsonPath))) return [];
            const text = await Fs.readTextFile(packageJsonPath);
            const parsed = JSON.parse(text) as { scripts?: Record<string, string> };
            const scripts = Object.keys(parsed.scripts ?? {});
            this._cache.set(cwdBackend, {
                expiresAt: now + NpmScriptsSpecProvider.TTL_MS,
                scripts,
            });
            return scripts;
        } catch {
            Logger.error(`[NpmScriptsSpecProvider] failed to read/parse package.json in '${cwdBackend}'`);
            return [];
        }
    }
}

