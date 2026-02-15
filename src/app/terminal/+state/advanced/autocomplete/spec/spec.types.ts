import { QueryContext } from "../autocomplete.types";

export type CommandSpec = {
    name: string;
    source?: "fig";
    sourceUrl?: string;
    subcommands?: string[];
    options?: string[];
    scriptProviderId?: string;
};

export type SpecProviderContext = {
    queryContext: QueryContext;
    command: string;
    args: string[];
};

export interface SpecSuggestionProvider {
    readonly id: string;
    suggest(context: SpecProviderContext): Promise<string[]>;
}
