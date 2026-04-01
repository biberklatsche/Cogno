import { AutocompletePathSupport } from "@cogno/core-support";
import { PathFactory } from "@cogno/core-host";
import { TerminalHistoryPersistenceService } from "../../history/terminal-history-persistence.service";
import { AutocompleteSuggestion, CdQueryContext, QueryContext } from "../autocomplete.types";
import { HistoryDirectoryScorer } from "./scoring/history-directory.scorer";
import { TerminalAutocompleteSuggestor } from "./terminal-autocomplete.suggestor";

export class HistoryDirectorySuggestor implements TerminalAutocompleteSuggestor {
    readonly id = "history-directory";
    readonly inputPattern = /^\s*cd(?:\s+.*)?$/;

    constructor(private readonly persistence: TerminalHistoryPersistenceService) {}

    matches(context: QueryContext): boolean {
        return context.mode === "cd" && this.inputPattern.test(context.beforeCursor);
    }

    async suggest(context: QueryContext): Promise<AutocompleteSuggestion[]> {
        if (context.mode !== "cd") return [];
        return this.suggestDirectories(context);
    }

    private async suggestDirectories(context: CdQueryContext): Promise<AutocompleteSuggestion[]> {
        const tokens = this.extractTokens(context.fragment, context.shellContext);
        const lookupFragment = tokens[0] ?? context.fragment;
        const rows = await this.persistence.searchDirectories(lookupFragment, 100);
        const pathAdapter = PathFactory.createAdapter(context.shellContext);
        const cwdNorm = AutocompletePathSupport.normalizeCwd(context.cwd, pathAdapter);
        const now = Date.now();

        const result: AutocompleteSuggestion[] = [];
        for (const row of rows) {
            const effectiveTokens = tokens.length > 0
                ? tokens
                : this.extractTokens(context.fragment, context.shellContext);
            const score = HistoryDirectoryScorer.scoreRow(row, effectiveTokens, now);
            if (score === null) continue;

            const relative = AutocompletePathSupport.toRelativePath(row.path, cwdNorm);
            if (relative === ".") continue;

            const displayPath = AutocompletePathSupport.toDisplayPath(row.path, cwdNorm, pathAdapter);
            if (displayPath === "." || displayPath === ".." || AutocompletePathSupport.isParentTraversalOnly(displayPath)) continue;
            const directoryPath = AutocompletePathSupport.appendDirectorySeparator(displayPath, context.shellContext);
            const escapedDirectoryPath = AutocompletePathSupport.escapePathForAutocompleteInsert(
                directoryPath,
                context.shellContext,
            );

            result.push({
                label: AutocompletePathSupport.shortenParentTraversalDisplay(directoryPath, context.shellContext),
                insertText: escapedDirectoryPath,
                score,
                source: "history-dir",
                replaceStart: context.replaceStart,
                replaceEnd: context.replaceEnd,
                selectedPath: row.path,
                completionBehavior: "continue",
            });
        }
        return result;
    }

    private extractTokens(fragment: string, shellContext: CdQueryContext["shellContext"]): string[] {
        return AutocompletePathSupport
            .splitAutocompleteFragmentTokens(fragment, shellContext)
            .map(token => token.toLowerCase())
            .filter(Boolean);
    }
}

