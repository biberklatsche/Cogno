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
        const rows = await this.persistence.searchDirectories(context.fragment, 100);
        const cwdNorm = AutocompletePathUtil.normalizeCwd(context.cwd, context.shellContext);

        const result: AutocompleteSuggestion[] = [];
        for (const row of rows) {
            const relative = AutocompletePathUtil.toRelativePath(row.path, cwdNorm);
            if (relative === ".") continue;

            const displayPath = AutocompletePathUtil.toDisplayPath(row.path, cwdNorm, context.shellContext);
            if (displayPath === "." || displayPath === ".." || AutocompletePathUtil.isParentTraversalOnly(displayPath)) continue;

            const starts = row.basename.toLowerCase().startsWith(context.fragment.toLowerCase());
            const contains = row.basename.toLowerCase().includes(context.fragment.toLowerCase());
            const score = row.selectCount * 30 + row.visitCount * 5 + (starts ? 80 : contains ? 25 : 0);

            result.push({
                label: displayPath,
                detail: row.path,
                insertText: displayPath,
                score,
                source: "history-dir",
                kind: "directory",
                replaceStart: context.replaceStart,
                replaceEnd: context.replaceEnd,
                selectedPath: row.path,
            });
        }
        return result;
    }
}
