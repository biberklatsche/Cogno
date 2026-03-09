import { readDir } from "@tauri-apps/plugin-fs";

import { PathFactory } from "../../adapter/path.factory";
import { AutocompletePathUtil } from "../autocomplete-path.util";
import { AutocompleteSuggestion, CdQueryContext, QueryContext } from "../autocomplete.types";
import { TerminalAutocompleteSuggestor } from "./terminal-autocomplete.suggestor";
import { Logger } from "../../../../../_tauri/logger";

export class FilesystemDirectorySuggestor implements TerminalAutocompleteSuggestor {
    readonly id = "filesystem-directory";
    readonly inputPattern = /^\s*cd(?:\s+.*)?$/;
    private static readonly DIR_CACHE_TTL_MS = 800;
    private static readonly DIR_CACHE_MAX = 32;

    private readonly _dirCache = new Map<string, { expiresAt: number; candidates: DirectoryCandidate[] }>();
    private _lastFilter?: {
        dirKey: string;
        query: string;
        matches: DirectoryCandidate[];
    };

    matches(context: QueryContext): boolean {
        return context.mode === "cd" && this.inputPattern.test(context.beforeCursor);
    }

    async suggest(context: QueryContext): Promise<AutocompleteSuggestion[]> {
        if (context.mode !== "cd") return [];
        return this.suggestDirectories(context);
    }

    private async suggestDirectories(context: CdQueryContext): Promise<AutocompleteSuggestion[]> {
        const adapter = PathFactory.createAdapter(context.shellContext);
        const cwdNorm = AutocompletePathUtil.normalizeCwd(context.cwd, context.shellContext);
        const lookup = this.resolveLookup(cwdNorm, context.fragment, adapter);
        if (!lookup) return [];
        const query = lookup.namePrefix.toLowerCase();
        const lookupBackend = adapter.render(lookup.parentNorm, { purpose: "backend_fs" });
        if (!lookupBackend) return [];

        const candidates = await this.readDirectoryCandidates(lookupBackend, cwdNorm, context.shellContext, adapter);
        if (candidates.length === 0) return [];

        const reusableBase =
            this._lastFilter &&
            this._lastFilter.dirKey === lookupBackend &&
            query.startsWith(this._lastFilter.query)
                ? this._lastFilter.matches
                : candidates;

        const matches = reusableBase.filter(candidate => !query || candidate.entryNameLower.includes(query));
        this._lastFilter = {
            dirKey: lookupBackend,
            query,
            matches,
        };

        return matches.map(candidate => {
            const starts = candidate.entryNameLower.startsWith(query);
            const contains = candidate.entryNameLower.includes(query);
            const score = (starts ? 70 : contains ? 20 : 0) + 20;
            return {
                label: AutocompletePathUtil.shortenParentTraversalDisplay(candidate.displayPath),
                detail: candidate.childNorm,
                insertText: candidate.displayPath,
                score,
                source: "fs-dir",
                replaceStart: context.replaceStart,
                replaceEnd: context.replaceEnd,
                selectedPath: candidate.childNorm,
            };
        });
    }

    private resolveLookup(cwdNorm: string, fragment: string, adapter: ReturnType<typeof PathFactory.createAdapter>):
        { parentNorm: string; namePrefix: string } | undefined {
        const trimmed = fragment.trim();
        if (!trimmed) {
            return { parentNorm: cwdNorm, namePrefix: "" };
        }

        const normalizedFragment = trimmed.replace(/\\/g, "/");
        const endsWithSlash = normalizedFragment.endsWith("/");
        const slashIdx = normalizedFragment.lastIndexOf("/");

        if (endsWithSlash) {
            const parentNorm = this.normalizeInputPath(cwdNorm, normalizedFragment, adapter);
            if (!parentNorm) return undefined;
            return { parentNorm, namePrefix: "" };
        }

        if (slashIdx < 0) {
            return { parentNorm: cwdNorm, namePrefix: normalizedFragment };
        }

        const parentInput = normalizedFragment.slice(0, slashIdx + 1);
        const namePrefix = normalizedFragment.slice(slashIdx + 1);
        const parentNorm = this.normalizeInputPath(cwdNorm, parentInput, adapter);
        if (!parentNorm) return undefined;
        return { parentNorm, namePrefix };
    }

    private normalizeInputPath(cwdNorm: string, inputPath: string, adapter: ReturnType<typeof PathFactory.createAdapter>): string | undefined {
        const absoluteLike = inputPath.startsWith("/") || /^[a-zA-Z]:/.test(inputPath) || inputPath.startsWith("\\\\");
        try {
            if (absoluteLike) {
                return adapter.normalize(inputPath);
            }

            const cwdBackend = adapter.render(cwdNorm, { purpose: "backend_fs" });
            if (!cwdBackend) return undefined;
            const sep = cwdBackend.includes("\\") ? "\\" : "/";
            const joined = cwdBackend.endsWith(sep) ? `${cwdBackend}${inputPath}` : `${cwdBackend}${sep}${inputPath}`;
            return adapter.normalize(joined);
        } catch {
            return undefined;
        }
    }

    private async readDirectoryCandidates(
        lookupBackend: string,
        cwdNorm: string,
        shellContext: QueryContext["shellContext"],
        adapter: ReturnType<typeof PathFactory.createAdapter>
    ): Promise<DirectoryCandidate[]> {
        const now = Date.now();
        const cached = this._dirCache.get(lookupBackend);
        if (cached && cached.expiresAt > now) {
            return cached.candidates;
        }

        let entries: Awaited<ReturnType<typeof readDir>>;
        try {
            entries = await readDir(lookupBackend);
        } catch (err) {
            Logger.error(`[FilesystemDirectorySuggestor] readDir failed for '${lookupBackend}': ${String(err)}`);
            return [];
        }

        const sep = lookupBackend.includes("\\") ? "\\" : "/";
        const candidates: DirectoryCandidate[] = [];
        for (const entry of entries) {
            if (!entry.isDirectory) continue;
            const childBackend = lookupBackend.endsWith(sep) ? `${lookupBackend}${entry.name}` : `${lookupBackend}${sep}${entry.name}`;
            let childNorm: string;
            try {
                childNorm = adapter.normalize(childBackend);
            } catch {
                continue;
            }

            const displayPath = AutocompletePathUtil.toDisplayPath(childNorm, cwdNorm, shellContext);
            if (displayPath === "." || displayPath === ".." || AutocompletePathUtil.isParentTraversalOnly(displayPath)) continue;
            candidates.push({
                entryName: entry.name,
                entryNameLower: entry.name.toLowerCase(),
                childNorm,
                displayPath,
            });
        }

        this.setDirCache(lookupBackend, {
            expiresAt: now + FilesystemDirectorySuggestor.DIR_CACHE_TTL_MS,
            candidates,
        });
        return candidates;
    }

    private setDirCache(key: string, value: { expiresAt: number; candidates: DirectoryCandidate[] }): void {
        if (this._dirCache.size >= FilesystemDirectorySuggestor.DIR_CACHE_MAX) {
            const oldestKey = this._dirCache.keys().next().value;
            if (oldestKey) this._dirCache.delete(oldestKey);
        }
        this._dirCache.set(key, value);
    }
}

type DirectoryCandidate = {
    entryName: string;
    entryNameLower: string;
    childNorm: string;
    displayPath: string;
};
