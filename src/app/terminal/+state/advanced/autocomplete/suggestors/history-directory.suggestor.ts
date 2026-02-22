import { TerminalHistoryPersistenceService } from "../../history/terminal-history-persistence.service";
import { AutocompletePathUtil } from "../autocomplete-path.util";
import { AutocompleteSuggestion, CdQueryContext, QueryContext } from "../autocomplete.types";
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
        const tokens = this.extractTokens(context.fragment);
        const lookupFragment = tokens[0] ?? context.fragment;
        const rows = await this.persistence.searchDirectories(lookupFragment, 100);
        const cwdNorm = AutocompletePathUtil.normalizeCwd(context.cwd, context.shellContext);

        const result: AutocompleteSuggestion[] = [];
        for (const row of rows) {
            const pathLower = row.path.toLowerCase();
            const basenameLower = row.basename.toLowerCase();
            const matchesAllTokens = tokens.every(token => pathLower.includes(token) || basenameLower.includes(token));
            if (!matchesAllTokens) continue;

            const relative = AutocompletePathUtil.toRelativePath(row.path, cwdNorm);
            if (relative === ".") continue;

            const displayPath = AutocompletePathUtil.toDisplayPath(row.path, cwdNorm, context.shellContext);
            if (displayPath === "." || displayPath === ".." || AutocompletePathUtil.isParentTraversalOnly(displayPath)) continue;

            const primaryToken = tokens.length > 0 ? tokens[0] : context.fragment.toLowerCase();
            const starts = basenameLower.startsWith(primaryToken);
            const contains = basenameLower.includes(primaryToken);
            const score = row.selectCount * 30 + row.visitCount * 5 + (starts ? 80 : contains ? 25 : 0);

            result.push({
                label: displayPath,
                detail: row.path,
                insertText: displayPath,
                score,
                source: "history-dir",
                replaceStart: context.replaceStart,
                replaceEnd: context.replaceEnd,
                selectedPath: row.path,
            });
        }
        return result;
    }

    private extractTokens(fragment: string): string[] {
        if (!fragment) return [];
        return fragment
            .trim()
            .split(/\s+/)
            .map(t => t.toLowerCase())
            .filter(Boolean);
    }
}
