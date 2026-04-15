import { TerminalHistoryPersistenceService } from "../../history/terminal-history-persistence.service";
import { AutocompleteSuggestion, QueryContext } from "../autocomplete.types";
import { HistoryCommandScorer } from "./scoring/history-command.scorer";
import { TerminalAutocompleteSuggestor } from "./terminal-autocomplete.suggestor";

const MAX_HISTORY_COMMAND_SUGGESTIONS = 100;
const EMPTY_QUERY_SELECT_WEIGHT = 1000;
const EMPTY_QUERY_EXEC_WEIGHT = 100;
const EMPTY_QUERY_CWD_SELECT_WEIGHT = 2500;
const EMPTY_QUERY_CWD_EXEC_WEIGHT = 350;
const EMPTY_QUERY_RECENCY_DIVISOR_MS = 1000;
const EMPTY_QUERY_CWD_RECENCY_DIVISOR_MS = 250;

function consistsOnlyOfPromptWords(command: string, promptWords: Set<string>): boolean {
  const words = HistoryCommandScorer.tokenizeWords(command);
  return words.length > 0 && words.every((word) => promptWords.has(word));
}

export class HistoryCommandSuggestor implements TerminalAutocompleteSuggestor {
  readonly id = "history-command";
  readonly inputPattern = /.*/;

  constructor(private readonly persistence: TerminalHistoryPersistenceService) {}

  matches(context: QueryContext): boolean {
    return context.mode === "command" && this.inputPattern.test(context.beforeCursor);
  }

  async suggest(context: QueryContext): Promise<AutocompleteSuggestion[]> {
    const query = context.mode === "command" ? context.query : "";
    const queryTokens = HistoryCommandScorer.uniqueTokens(query);

    // Seed lookup with first token to also support multi-token queries like "gi pu".
    const repoSeed = queryTokens[0] ?? "";
    const rows = await this.persistence.searchCommands(repoSeed, context.cwd, 250);
    if (!query && rows.length === 0) return [];
    if (query && queryTokens.length === 0) return [];

    const now = Date.now();
    const inputCommandToken = HistoryCommandScorer.firstToken(context.inputText);
    const promptWords = new Set(HistoryCommandScorer.tokenizeWords(context.inputText));
    const corpusSize = Math.max(rows.length, 1);
    const docFreq = HistoryCommandScorer.buildDocFreq(rows, queryTokens);

    const suggestions: Array<AutocompleteSuggestion | null> = rows
      .filter((row) => !consistsOnlyOfPromptWords(row.command, promptWords))
      .map((row) => {
        const score =
          queryTokens.length === 0
            ? this.scoreRowForEmptyQuery(row)
            : HistoryCommandScorer.scoreRow(
                row,
                queryTokens,
                docFreq,
                corpusSize,
                inputCommandToken,
                now,
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

  private scoreRowForEmptyQuery(row: {
    readonly selectCount: number;
    readonly execCount: number;
    readonly lastSelectAt: number;
    readonly lastExecAt: number;
    readonly cwdSelectCount: number;
    readonly cwdExecCount: number;
    readonly cwdLastSelectAt: number;
    readonly cwdLastExecAt: number;
  }): number {
    const latestInteractionTimestamp = Math.max(row.lastSelectAt || 0, row.lastExecAt || 0);
    const latestCurrentCwdInteractionTimestamp = Math.max(
      row.cwdLastSelectAt || 0,
      row.cwdLastExecAt || 0,
    );
    return (
      row.selectCount * EMPTY_QUERY_SELECT_WEIGHT +
      row.execCount * EMPTY_QUERY_EXEC_WEIGHT +
      row.cwdSelectCount * EMPTY_QUERY_CWD_SELECT_WEIGHT +
      row.cwdExecCount * EMPTY_QUERY_CWD_EXEC_WEIGHT +
      Math.floor(latestInteractionTimestamp / EMPTY_QUERY_RECENCY_DIVISOR_MS) +
      Math.floor(latestCurrentCwdInteractionTimestamp / EMPTY_QUERY_CWD_RECENCY_DIVISOR_MS)
    );
  }
}
