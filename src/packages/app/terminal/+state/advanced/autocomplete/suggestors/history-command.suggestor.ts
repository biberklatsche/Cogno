import { TerminalHistoryPersistenceService } from "../../history/terminal-history-persistence.service";
import { AutocompleteSuggestion, QueryContext } from "../autocomplete.types";
import { HistoryCommandScorer } from "./scoring/history-command.scorer";
import { TerminalAutocompleteSuggestor } from "./terminal-autocomplete.suggestor";
const MAX_HISTORY_COMMAND_SUGGESTIONS = 3;

function consistsOnlyOfPromptWords(command: string, promptWords: Set<string>): boolean {
    const words = HistoryCommandScorer.tokenizeWords(command);
    return words.length > 0 && words.every(word => promptWords.has(word));
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

                const executedInCurrentCwd = row.cwdExecCount > 0;
                const description = executedInCurrentCwd
                    ? "executed in current directory"
                    : "executed elsewhere on this computer";

                return {
                    label: row.command,
                    description,
                    insertText: row.command,
                    score,
                    source: "history-cmd",
                    // History commands must replace the entire terminal input.
                    replaceStart: 0,
                    replaceEnd: context.inputText.length,
                    selectedCommand: row.command,
                } satisfies AutocompleteSuggestion;
            });

        return suggestions
            .filter((item): item is AutocompleteSuggestion => item !== null)
            .sort((leftSuggestion, rightSuggestion) => rightSuggestion.score - leftSuggestion.score)
            .slice(0, MAX_HISTORY_COMMAND_SUGGESTIONS);
    }
}
