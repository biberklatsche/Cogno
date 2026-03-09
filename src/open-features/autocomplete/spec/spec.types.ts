import { AutocompleteQueryContextContract, ShellTypeContract } from "@cogno/core-sdk";

export type ShellConstraint = ShellTypeContract;

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

export type SpecProviderParams = Record<string, string | number | boolean | string[] | number[] | boolean[]>;

export type SpecProviderBinding = {
    providerId: string;
    when?: SpecProviderWhen;
    source?: string;
    baseScore?: number;
    params?: SpecProviderParams;
};

export type SpecProviderContext = {
    queryContext: AutocompleteQueryContextContract;
    command: string;
    args: string[];
    binding: SpecProviderBinding;
};

export type SpecProvidedSuggestion = {
    label: string;
    insertText?: string;
    description?: string;
    detail?: string;
    selectedPath?: string;
};

export interface SpecSuggestionProvider {
    readonly id: string;
    suggest(context: SpecProviderContext): Promise<ReadonlyArray<SpecProvidedSuggestion>>;
}
