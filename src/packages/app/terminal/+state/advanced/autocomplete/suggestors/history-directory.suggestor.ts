import { TerminalHistoryPersistenceService } from "../../history/terminal-history-persistence.service";
import { AutocompleteSuggestion, CdQueryContext, QueryContext } from "../autocomplete.types";
import { HistoryDirectoryScorer } from "./scoring/history-directory.scorer";
import { TerminalAutocompleteSuggestor } from "./terminal-autocomplete.suggestor";
import { AutocompletePathUtil } from "@cogno/core-host";

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
        const cwdNorm = AutocompletePathUtil.normalizeCwd(context.cwd, context.shellContext);
        const now = Date.now();

        const result: AutocompleteSuggestion[] = [];
        for (const row of rows) {
            const effectiveTokens = tokens.length > 0
                ? tokens
                : this.extractTokens(context.fragment, context.shellContext);
            const score = HistoryDirectoryScorer.scoreRow(row, effectiveTokens, now);
            if (score === null) continue;

            const relative = AutocompletePathUtil.toRelativePath(row.path, cwdNorm);
            if (relative === ".") continue;

            const displayPath = AutocompletePathUtil.toDisplayPath(row.path, cwdNorm, context.shellContext);
            if (displayPath === "." || displayPath === ".." || AutocompletePathUtil.isParentTraversalOnly(displayPath)) continue;
            const directoryPath = AutocompletePathUtil.appendDirectorySeparator(displayPath, context.shellContext);
            const escapedDirectoryPath = AutocompletePathUtil.escapePathForAutocompleteInsert(
                directoryPath,
                context.shellContext,
            );

            result.push({
                label: AutocompletePathUtil.shortenParentTraversalDisplay(directoryPath, context.shellContext),
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
        return AutocompletePathUtil
            .splitAutocompleteFragmentTokens(fragment, shellContext)
            .map(token => token.toLowerCase())
            .filter(Boolean);
    }
}
