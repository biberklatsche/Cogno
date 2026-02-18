import { QueryContext } from "../autocomplete.types";

export type ShellConstraint = "PowerShell" | "ZSH" | "Bash" | "GitBash" | "Fish";

export type FigArgSpec = {
    name: string;
    description?: string;
};

export type FigOptionSpec = {
    name: string | string[];
    description?: string;
    args?: FigArgSpec | FigArgSpec[];
    isRepeatable?: boolean;
    providers?: SpecProviderBinding[];
};

export type FigSubcommandSpec = {
    name: string | string[];
    description?: string;
    args?: FigArgSpec | FigArgSpec[];
    providers?: SpecProviderBinding[];
    subcommands?: Array<string | FigSubcommandSpec>;
    options?: Array<string | FigOptionSpec>;
};

export type CommandSpec = {
    name: string;
    source?: "fig";
    sourceUrl?: string;
    description?: string;
    subcommands?: Array<string | FigSubcommandSpec>;
    options?: Array<string | FigOptionSpec>;
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
