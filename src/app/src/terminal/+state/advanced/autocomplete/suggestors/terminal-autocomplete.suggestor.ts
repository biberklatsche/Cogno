import { AutocompleteSuggestion, QueryContext } from "../autocomplete.types";

export interface TerminalAutocompleteSuggestor {
    readonly id: string;
    readonly inputPattern: RegExp;
    matches(context: QueryContext): boolean;
    suggest(context: QueryContext): Promise<AutocompleteSuggestion[]>;
}

