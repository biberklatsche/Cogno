import { SessionCommandLog } from "@cogno/core/session/command-log/session-command-log";
import { AutocompleteSuggestion, QueryContext } from "../autocomplete.types";
import { SuggestionPatternReducer } from "./scoring/suggestion-pattern.reducer";
import { TerminalAutocompleteSuggestor } from "./terminal-autocomplete.suggestor";

export class CommandPatternSuggestor implements TerminalAutocompleteSuggestor {
  readonly id = "history-command-pattern";
  readonly inputPattern = /.+/;

  constructor(
    private readonly commandLog: SessionCommandLog,
    private readonly suggestionPatternReducer: SuggestionPatternReducer = new SuggestionPatternReducer(),
  ) {}

  matches(context: QueryContext): boolean {
    return context.mode === "command" && this.inputPattern.test(context.beforeCursor);
  }

  async suggest(context: QueryContext): Promise<AutocompleteSuggestion[]> {
    const query = context.mode === "command" ? context.query : "";
    if (!query) {
      return [];
    }

    const patterns = await this.commandLog.searchCommandPatterns(query, 100);
    return this.suggestionPatternReducer.reduce(patterns, context);
  }
}
