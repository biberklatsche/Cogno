import { readDir } from "@tauri-apps/plugin-fs";

import { PathFactory } from "../../adapter/path.factory";
import { AutocompletePathUtil } from "../autocomplete-path.util";
import { AutocompleteSuggestion, CdQueryContext, QueryContext } from "../autocomplete.types";
import { TerminalAutocompleteSuggestor } from "./terminal-autocomplete.suggestor";
import { Logger } from "../../../../../_tauri/logger";

export class FilesystemDirectorySuggestor implements TerminalAutocompleteSuggestor {
    readonly id = "filesystem-directory";
    readonly inputPattern = /^\s*cd(?:\s+.*)?$/;

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

        let entries: Awaited<ReturnType<typeof readDir>>;
        try {
            entries = await readDir(lookupBackend);
        } catch (err) {
            Logger.error(`[FilesystemDirectorySuggestor] readDir failed for '${lookupBackend}': ${String(err)}`);
            return [];
        }
        const sep = lookupBackend.includes("\\") ? "\\" : "/";

        const result: AutocompleteSuggestion[] = [];
        for (const entry of entries) {
            if (!entry.isDirectory) continue;
            if (query && !entry.name.toLowerCase().includes(query)) continue;

            const childBackend = lookupBackend.endsWith(sep) ? `${lookupBackend}${entry.name}` : `${lookupBackend}${sep}${entry.name}`;
            let childNorm: string;
            try {
                childNorm = adapter.normalize(childBackend);
            } catch {
                continue;
            }

            const displayPath = AutocompletePathUtil.toDisplayPath(childNorm, cwdNorm, context.shellContext);
            if (displayPath === "." || displayPath === ".." || AutocompletePathUtil.isParentTraversalOnly(displayPath)) continue;
            const starts = entry.name.toLowerCase().startsWith(query);
            const contains = entry.name.toLowerCase().includes(query);
            const score = (starts ? 70 : contains ? 20 : 0) + 20;

            result.push({
                label: displayPath,
                detail: childNorm,
                insertText: displayPath,
                score,
                source: "fs-dir",
                kind: "directory",
                replaceStart: context.replaceStart,
                replaceEnd: context.replaceEnd,
                selectedPath: childNorm,
            });
        }

        return result;
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
}
