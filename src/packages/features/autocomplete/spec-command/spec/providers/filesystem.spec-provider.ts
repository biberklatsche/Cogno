import { FilesystemContract, ShellContextContract } from "@cogno/core-api";
import {
    FilesystemSpecProviderParams,
    SpecProvidedSuggestion,
    SpecProviderContext,
    SpecSuggestionProvider,
} from "../spec.types";
import { FilesystemAutocompletePathUtil } from "./filesystem-autocomplete-path.util";

type FilesystemProviderKind = "file" | "directory";

type Lookup = {
    parentNorm: string;
    namePrefix: string;
};

type Candidate = {
    entryNameLower: string;
    suggestion: SpecProvidedSuggestion;
};

type CacheEntry = {
    expiresAt: number;
    candidates: Candidate[];
};

export class FilesystemSpecProvider implements SpecSuggestionProvider {
    readonly id = "filesystem";
    private static readonly CACHE_TTL_MS = 800;
    private static readonly CACHE_MAX = 32;
    private static readonly SEARCH_LIMIT = 200;

    private readonly cache = new Map<string, CacheEntry>();

    constructor(private readonly filesystem: FilesystemContract) {}

    async suggest(context: SpecProviderContext): Promise<ReadonlyArray<SpecProvidedSuggestion>> {
        const cwdNorm = this.filesystem.normalizePath(context.queryContext.cwd, context.queryContext.shellContext);
        const fragment = this.resolveFragment(context);
        const lookup = this.resolveLookup(cwdNorm, fragment, context.queryContext.shellContext);
        if (!lookup) return [];

        const params = this.readParams(context);
        const kinds = this.resolveKinds(params);
        const appendSlashToDirectories = params.appendSlashToDirectories === true;
        const continueSuggestions = params.continueSuggestions === true;
        const query = lookup.namePrefix.toLowerCase();
        const cacheKey = [
            lookup.parentNorm,
            kinds.join(","),
            appendSlashToDirectories ? "slash" : "plain",
            continueSuggestions ? "continue" : "final",
            query,
        ].join("::");
        const candidates = await this.readCandidates(
            lookup.parentNorm,
            cwdNorm,
            context.queryContext.shellContext,
            kinds,
            appendSlashToDirectories,
            continueSuggestions,
            query,
            cacheKey,
        );
        if (candidates.length === 0) return [];

        return candidates.map(candidate => candidate.suggestion);
    }

    private resolveFragment(context: SpecProviderContext): string {
        if (context.queryContext.mode === "cd") {
            return context.queryContext.fragment;
        }

        const tokens = context.args;
        const beforeCursor = context.queryContext.beforeCursor;
        const trailingSpace = /\s$/.test(beforeCursor);
        if (trailingSpace) return "";
        return tokens.at(-1) ?? "";
    }

    private resolveKinds(params: FilesystemSpecProviderParams): FilesystemProviderKind[] {
        const kinds = params.kinds ?? [];
        const filtered = kinds.filter((kind): kind is FilesystemProviderKind => kind === "file" || kind === "directory");
        return filtered.length ? filtered : ["file", "directory"];
    }

    private readParams(context: SpecProviderContext): FilesystemSpecProviderParams {
        return context.binding.providerId === "filesystem" && context.binding.params
            ? context.binding.params
            : {};
    }

    private resolveLookup(
        cwdNorm: string,
        fragment: string,
        shellContext: ShellContextContract,
    ): Lookup | undefined {
        const trimmed = fragment.trim();
        if (!trimmed) {
            return { parentNorm: cwdNorm, namePrefix: "" };
        }

        const unescapedFragment = FilesystemAutocompletePathUtil.unescapeAutocompletePathFragment(
            trimmed,
            shellContext,
        );
        const normalizedFragment = shellContext.shellType === "PowerShell"
            ? unescapedFragment.replace(/\\/g, "/")
            : unescapedFragment;
        const endsWithSlash = normalizedFragment.endsWith("/");
        const slashIdx = normalizedFragment.lastIndexOf("/");

        if (endsWithSlash) {
            const parentNorm = this.filesystem.resolvePath(cwdNorm, normalizedFragment, shellContext);
            if (!parentNorm) return undefined;
            return { parentNorm, namePrefix: "" };
        }

        if (slashIdx < 0) {
            return { parentNorm: cwdNorm, namePrefix: normalizedFragment };
        }

        const parentInput = normalizedFragment.slice(0, slashIdx + 1);
        const namePrefix = normalizedFragment.slice(slashIdx + 1);
        const parentNorm = this.filesystem.resolvePath(cwdNorm, parentInput, shellContext);
        if (!parentNorm) return undefined;
        return { parentNorm, namePrefix };
    }

    private async readCandidates(
        lookupPath: string,
        cwdNorm: string,
        shellContext: ShellContextContract,
        kinds: FilesystemProviderKind[],
        appendSlashToDirectories: boolean,
        continueSuggestions: boolean,
        query: string,
        cacheKey: string,
    ): Promise<Candidate[]> {
        const now = Date.now();
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return cached.candidates;
        }

        const entries = await this.filesystem.list(lookupPath, shellContext, {
            directoriesOnly: kinds.length === 1 && kinds[0] === "directory" ? true : undefined,
            filesOnly: kinds.length === 1 && kinds[0] === "file" ? true : undefined,
            query,
            limit: FilesystemSpecProvider.SEARCH_LIMIT,
        });

        const candidates: Candidate[] = [];
        for (const entry of entries) {
            if (!kinds.includes(entry.kind)) continue;
            const displayPath = this.filesystem.toDisplayPath(entry.path, cwdNorm, shellContext);
            if (
                displayPath === "."
                || displayPath === ".."
                || FilesystemAutocompletePathUtil.isParentTraversalOnly(displayPath)
            ) {
                continue;
            }

            const insertText = entry.kind === "directory" && appendSlashToDirectories
                ? this.filesystem.appendPathSeparator(displayPath, shellContext)
                : displayPath;
            const escapedInsertText = FilesystemAutocompletePathUtil.escapePathForAutocompleteInsert(
                insertText,
                shellContext,
            );

            candidates.push({
                entryNameLower: entry.name.toLowerCase(),
                suggestion: {
                    label: FilesystemAutocompletePathUtil.shortenParentTraversalDisplay(
                        insertText,
                        shellContext,
                    ),
                    insertText: escapedInsertText,
                    selectedPath: entry.path,
                    completionBehavior: continueSuggestions && entry.kind === "directory" ? "continue" : "final",
                },
            });
        }

        candidates.sort((leftCandidate, rightCandidate) =>
            leftCandidate.entryNameLower.localeCompare(rightCandidate.entryNameLower)
        );

        this.setCache(cacheKey, {
            expiresAt: now + FilesystemSpecProvider.CACHE_TTL_MS,
            candidates,
        });
        return candidates;
    }

    private setCache(key: string, value: CacheEntry): void {
        if (this.cache.size >= FilesystemSpecProvider.CACHE_MAX) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }
        this.cache.set(key, value);
    }
}



