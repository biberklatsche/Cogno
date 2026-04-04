import { TerminalHistoryPersistenceService } from "../../history/terminal-history-persistence.service";
import { AutocompleteSuggestion, QueryContext } from "../autocomplete.types";
import { SuggestionPatternReducer } from "./scoring/suggestion-pattern.reducer";
import { TerminalAutocompleteSuggestor } from "./terminal-autocomplete.suggestor";

export class HistoryCommandPatternSuggestor implements TerminalAutocompleteSuggestor {
    readonly id = "history-command-pattern";
    readonly inputPattern = /.+/;

    constructor(
        private readonly persistence: TerminalHistoryPersistenceService,
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

        const learnedCommandPatterns = await this.persistence.searchCommandPatterns(query, 100);
        return this.suggestionPatternReducer.reduce(learnedCommandPatterns, context);
    }
}


