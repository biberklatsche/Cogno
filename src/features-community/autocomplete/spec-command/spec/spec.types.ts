import { AutocompleteQueryContextContract, ShellTypeContract } from "@cogno/core-sdk";

export type ShellConstraint = ShellTypeContract;

export type ArgSpec = {
    name: string;
    description?: string;
};

export type OptionSpec = {
    name: string | string[];
    description?: string;
    args?: ArgSpec | ArgSpec[];
    isRepeatable?: boolean;
    providers?: SpecProviderBinding[];
};

export type SubcommandSpec = {
    name: string | string[];
    description?: string;
    args?: ArgSpec | ArgSpec[];
    providers?: SpecProviderBinding[];
    subcommands?: Array<string | SubcommandSpec>;
    options?: Array<string | OptionSpec>;
};

export type CommandSpec = {
    name: string;
    description?: string;
    subcommands?: Array<string | SubcommandSpec>;
    options?: Array<string | OptionSpec>;
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
    completionBehavior?: "final" | "continue";
};

export interface SpecSuggestionProvider {
    readonly id: string;
    suggest(context: SpecProviderContext): Promise<ReadonlyArray<SpecProvidedSuggestion>>;
}
