import { TerminalHistoryPersistenceService } from "../../history/terminal-history-persistence.service";
import { AutocompleteSuggestion, QueryContext } from "../autocomplete.types";
import { HistoryCommandScorer } from "./scoring/history-command.scorer";
import { TerminalAutocompleteSuggestor } from "./terminal-autocomplete.suggestor";

function consistsOnlyOfPromptWords(command: string, promptWords: Set<string>): boolean {
    const words = HistoryCommandScorer.tokenizeWords(command);
    return words.length > 0 && words.every(word => promptWords.has(word));
}

function formatTimeAgo(timestamp: number, now: number): string {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return "last executed: unknown";
    }

    const ageInSeconds = Math.max(0, Math.round((now - timestamp) / 1000));
    if (ageInSeconds < 60) {
        return "last executed: just now";
    }

    const ageInMinutes = Math.round(ageInSeconds / 60);
    if (ageInMinutes < 60) {
        return `last executed: ${ageInMinutes} minute${ageInMinutes === 1 ? "" : "s"} ago`;
    }

    const ageInHours = Math.round(ageInMinutes / 60);
    if (ageInHours < 24) {
        return `last executed: ${ageInHours} hour${ageInHours === 1 ? "" : "s"} ago`;
    }

    const ageInDays = Math.round(ageInHours / 24);
    if (ageInDays < 30) {
        return `last executed: ${ageInDays} day${ageInDays === 1 ? "" : "s"} ago`;
    }

    const ageInMonths = Math.round(ageInDays / 30.4);
    if (ageInMonths < 12) {
        return `last executed: ${ageInMonths} month${ageInMonths === 1 ? "" : "s"} ago`;
    }

    const ageInYears = Math.round(ageInDays / 365.25);
    return `last executed: ${ageInYears} year${ageInYears === 1 ? "" : "s"} ago`;
}

export class HistoryCommandSuggestor implements TerminalAutocompleteSuggestor {
    readonly id = "history-command";
    readonly inputPattern = /.+/;

    constructor(private readonly persistence: TerminalHistoryPersistenceService) {}

    matches(context: QueryContext): boolean {
        return context.mode === "command" && this.inputPattern.test(context.beforeCursor);
    }

    async suggest(context: QueryContext): Promise<AutocompleteSuggestion[]> {
        const query = context.mode === "command" ? context.query : "";
        if (!query) return [];
        const queryTokens = HistoryCommandScorer.uniqueTokens(query);
        if (queryTokens.length === 0) return [];

        // Seed lookup with first token to also support multi-token queries like "gi pu".
        const repoSeed = queryTokens[0];
        const rows = await this.persistence.searchCommands(repoSeed, context.cwd, 250);
        const now = Date.now();

        const inputCommandToken = HistoryCommandScorer.firstToken(context.inputText);
        const promptWords = new Set(HistoryCommandScorer.tokenizeWords(context.inputText));
        const corpusSize = Math.max(rows.length, 1);
        const docFreq = HistoryCommandScorer.buildDocFreq(rows, queryTokens);

        const suggestions: Array<AutocompleteSuggestion | null> = rows
            .filter(row => !consistsOnlyOfPromptWords(row.command, promptWords))
            .map(row => {
                const score = HistoryCommandScorer.scoreRow(
                    row,
                    queryTokens,
                    docFreq,
                    corpusSize,
                    inputCommandToken,
                    now
                );
                if (score === null) return null;

                return {
                    label: row.command,
                    detail: `exec: ${row.execCount}, selected: ${row.selectCount}`,
                    description: formatTimeAgo(row.lastExecAt, now),
                    insertText: row.command,
                    score,
                    source: "history-cmd",
                    // History commands must replace the entire terminal input.
                    replaceStart: 0,
                    replaceEnd: context.inputText.length,
                    selectedCommand: row.command,
                } satisfies AutocompleteSuggestion;
            });

        return suggestions.filter((item): item is AutocompleteSuggestion => item !== null);
    }
}
