import { AutocompleteQueryContextContract, ShellTypeContract } from "@cogno/core-sdk";

export type ShellConstraint = ShellTypeContract;

export type SingleOrArray<T> = T | T[];

export type ExecuteShellCommandInput = {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
};

export type ExecuteShellCommandResult = {
    stdout: string;
    stderr: string;
    status?: number;
};

export type ExecuteShellCommand = (
    input: ExecuteShellCommandInput
) => Promise<ExecuteShellCommandResult>;

export type Suggestion = {
    name?: string;
    description?: string;
    insertValue?: string;
    icon?: string;
    priority?: number;
    [key: string]: unknown;
};

export type Generator = {
    script?: string | string[];
    template?: string | string[];
    trigger?: string;
    custom?: (
        tokens: string[],
        executeShellCommand: ExecuteShellCommand,
        context?: unknown
    ) => Promise<ReadonlyArray<Suggestion | string> | string[] | Suggestion[] | undefined> | ReadonlyArray<Suggestion | string> | string[] | Suggestion[] | undefined;
    postProcess?: (
        out: string,
        prefix?: string,
        tokens?: string[]
    ) => ReadonlyArray<Suggestion | string> | string[] | Suggestion[] | undefined;
    generators?: SingleOrArray<Generator>;
    [key: string]: unknown;
};

export type ParserDirectives = {
    flagsArePosixNoncompliant?: boolean;
    optionsMustPrecedeArguments?: boolean;
    [key: string]: unknown;
};

export type ArgSpec = {
    name: string;
    description?: string;
    isOptional?: boolean;
    isVariadic?: boolean;
    suggestions?: ReadonlyArray<Suggestion | string>;
    generators?: SingleOrArray<Generator>;
    template?: string | string[];
    parserDirectives?: ParserDirectives;
    default?: string;
    debounce?: number;
    [key: string]: unknown;
};

export type OptionSpec = {
    name: string | string[];
    description?: string;
    args?: ArgSpec | ArgSpec[];
    isRepeatable?: boolean;
    providers?: SpecProviderBinding[];
    exclusiveOn?: string[];
    dependsOn?: string[];
    hidden?: boolean;
    priority?: number;
    icon?: string;
    insertValue?: string;
    [key: string]: unknown;
};

export type SubcommandSpec = {
    name: string | string[];
    description?: string;
    args?: ArgSpec | ArgSpec[];
    providers?: SpecProviderBinding[];
    subcommands?: Array<string | SubcommandSpec>;
    options?: Array<string | OptionSpec>;
    isDangerous?: boolean;
    hidden?: boolean;
    icon?: string;
    priority?: number;
    loadSpec?: string | CommandSpec | (() => Promise<CommandSpec>);
    [key: string]: unknown;
};

export type CommandSpec = {
    name: string;
    source?: "fig";
    sourceUrl?: string;
    description?: string;
    subcommands?: Array<string | SubcommandSpec>;
    options?: Array<string | OptionSpec>;
    subcommandOptions?: Record<string, string[]>;
    providers?: SpecProviderBinding[];
    shells?: ShellConstraint[];
    excludeShells?: ShellConstraint[];
    args?: ArgSpec | ArgSpec[];
    hidden?: boolean;
    loadSpec?: string | CommandSpec | (() => Promise<CommandSpec>);
    parserDirectives?: ParserDirectives;
    [key: string]: unknown;
};

export type VersionDiffMap = Record<string, unknown>;

export type GetVersionCommand = (
    executeShellCommand: ExecuteShellCommand
) => Promise<string>;

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
