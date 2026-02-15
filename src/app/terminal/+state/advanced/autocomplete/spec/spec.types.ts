import { QueryContext } from "../autocomplete.types";

export type ShellConstraint = "PowerShell" | "ZSH" | "Bash" | "GitBash" | "Fish";

export type CommandSpec = {
    name: string;
    source?: "fig";
    sourceUrl?: string;
    subcommands?: string[];
    options?: string[];
    subcommandOptions?: Record<string, string[]>;
    providers?: SpecProviderBinding[];
    shells?: ShellConstraint[];
    excludeShells?: ShellConstraint[];
};

export type SpecProviderWhen = {
    firstArgIn?: string[];
    argsRegex?: string;
    minArgs?: number;
    maxArgs?: number;
};

export type SpecProviderBinding = {
    providerId: string;
    when?: SpecProviderWhen;
    kind?: "command" | "script";
    source?: string;
    baseScore?: number;
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
