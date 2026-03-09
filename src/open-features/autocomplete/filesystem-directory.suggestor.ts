import {
    AutocompleteSuggestionContract,
    CdAutocompleteQueryContextContract,
    FilesystemContract,
    ShellContextContract,
    TerminalAutocompleteSuggestorContract,
} from "@cogno/core-sdk";
import { AutocompletePathUtil } from "./autocomplete-path.util";

export class FilesystemDirectorySuggestor implements TerminalAutocompleteSuggestorContract {
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

    constructor(private readonly filesystem: FilesystemContract) {}

    matches(context: CdAutocompleteQueryContextContract): boolean {
        return context.mode === "cd" && this.inputPattern.test(context.beforeCursor);
    }

    async suggest(context: CdAutocompleteQueryContextContract): Promise<AutocompleteSuggestionContract[]> {
        if (context.mode !== "cd") return [];
        return this.suggestDirectories(context);
    }

    private async suggestDirectories(
        context: CdAutocompleteQueryContextContract,
    ): Promise<AutocompleteSuggestionContract[]> {
        const cwdNorm = this.filesystem.normalizePath(context.cwd, context.shellContext);
        const lookup = this.resolveLookup(cwdNorm, context.fragment, context.shellContext);
        if (!lookup) return [];
        const query = lookup.namePrefix.toLowerCase();
        const candidates = await this.readDirectoryCandidates(lookup.parentNorm, cwdNorm, context.shellContext);
        if (candidates.length === 0) return [];

        const reusableBase =
            this._lastFilter &&
            this._lastFilter.dirKey === lookup.parentNorm &&
            query.startsWith(this._lastFilter.query)
                ? this._lastFilter.matches
                : candidates;

        const matches = reusableBase.filter(candidate => !query || candidate.entryNameLower.includes(query));
        this._lastFilter = {
            dirKey: lookup.parentNorm,
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

    private resolveLookup(
        cwdNorm: string,
        fragment: string,
        shellContext: ShellContextContract,
    ):
        { parentNorm: string; namePrefix: string } | undefined {
        const trimmed = fragment.trim();
        if (!trimmed) {
            return { parentNorm: cwdNorm, namePrefix: "" };
        }

        const normalizedFragment = trimmed.replace(/\\/g, "/");
        const endsWithSlash = normalizedFragment.endsWith("/");
        const slashIdx = normalizedFragment.lastIndexOf("/");

        if (endsWithSlash) {
            const parentNorm = this.normalizeInputPath(cwdNorm, normalizedFragment, shellContext);
            if (!parentNorm) return undefined;
            return { parentNorm, namePrefix: "" };
        }

        if (slashIdx < 0) {
            return { parentNorm: cwdNorm, namePrefix: normalizedFragment };
        }

        const parentInput = normalizedFragment.slice(0, slashIdx + 1);
        const namePrefix = normalizedFragment.slice(slashIdx + 1);
        const parentNorm = this.normalizeInputPath(cwdNorm, parentInput, shellContext);
        if (!parentNorm) return undefined;
        return { parentNorm, namePrefix };
    }

    private normalizeInputPath(cwdNorm: string, inputPath: string, shellContext: ShellContextContract): string | undefined {
        return this.filesystem.resolvePath(cwdNorm, inputPath, shellContext);
    }

    private async readDirectoryCandidates(
        lookupPath: string,
        cwdNorm: string,
        shellContext: ShellContextContract,
    ): Promise<DirectoryCandidate[]> {
        const now = Date.now();
        const cached = this._dirCache.get(lookupPath);
        if (cached && cached.expiresAt > now) {
            return cached.candidates;
        }

        const entries = await this.filesystem.list(lookupPath, shellContext, { directoriesOnly: true });
        const candidates: DirectoryCandidate[] = [];
        for (const entry of entries) {
            if (entry.kind !== "directory") continue;
            const displayPath = this.filesystem.toDisplayPath(entry.path, cwdNorm, shellContext);
            if (displayPath === "." || displayPath === ".." || AutocompletePathUtil.isParentTraversalOnly(displayPath)) continue;
            candidates.push({
                entryName: entry.name,
                entryNameLower: entry.name.toLowerCase(),
                childNorm: entry.path,
                displayPath,
            });
        }

        this.setDirCache(lookupPath, {
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
