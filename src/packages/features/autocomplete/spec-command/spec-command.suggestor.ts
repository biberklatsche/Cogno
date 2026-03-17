import {
    AutocompleteQueryContextContract,
    AutocompleteSuggestionContract,
    ShellTypeContract,
    TerminalAutocompleteSuggestorContract,
} from "@cogno/core-sdk";
import { CommandSpecSource } from "./spec/command-spec.source";
import {
    CommandSpec,
    OptionSpec,
    SubcommandSpec,
    ShellConstraint,
    SpecProviderBinding,
    SpecSuggestionProvider
} from "./spec/spec.types";

type ParsedInput = {
    tokens: Array<{ value: string; start: number; end: number }>;
    activeTokenIndex: number;
    activeStart: number;
    activeEnd: number;
    activeValue: string;
};

type ShellScopedCommand = {
    name: string;
    lower: string;
    description?: string;
};

type PreparedOption = {
    names: string[];
    primary: string;
    description?: string;
    argCount: number;
    providers: SpecProviderBinding[];
    isRepeatable: boolean;
};

type PreparedNode = {
    names: string[];
    primary: string;
    description?: string;
    argCount: number;
    providers: SpecProviderBinding[];
    subcommands: PreparedNode[];
    options: PreparedOption[];
    subByAlias: Map<string, PreparedNode>;
    optionByAlias: Map<string, PreparedOption>;
};

type PreparedSpec = {
    root: PreparedNode;
    globalProviders: SpecProviderBinding[];
};

type TraverseState = {
    node: PreparedNode;
    usedSubcommands: Set<string>;
    usedOptionAliases: Set<string>;
    pendingArgs: number;
    pendingProviders: SpecProviderBinding[];
    pendingArgSource: "subcommand" | "option" | undefined;
};

const ROOT_NAME = "__root__";

function namesOf(name: string | string[]): string[] {
    return Array.isArray(name) ? name : [name];
}

function dedupe(values: string[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const value of values) {
        const trimmed = value.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        out.push(trimmed);
    }
    return out;
}

function primaryName(name: string | string[]): string {
    return namesOf(name)[0] ?? "";
}

function toSubcommands(source?: Array<string | SubcommandSpec>): SubcommandSpec[] {
    if (!source?.length) return [];
    return source.map(s => (typeof s === "string" ? { name: s } : s));
}

function toOptions(source?: Array<string | OptionSpec>): OptionSpec[] {
    if (!source?.length) return [];
    return source.map(s => (typeof s === "string" ? { name: s } : s));
}

function mergeLegacySubcommandOptions(spec: CommandSpec): SubcommandSpec[] {
    const subcommands = toSubcommands(spec.subcommands).map(sub => ({ ...sub }));
    const legacyEntries = Object.entries(spec.subcommandOptions ?? {});

    for (const [subcommandName, legacyOptions] of legacyEntries) {
        const normalizedLegacyOptions = toOptions(legacyOptions);
        const existing = subcommands.find(sub =>
            namesOf(sub.name).some(alias => alias.toLowerCase() === subcommandName.toLowerCase())
        );

        if (existing) {
            existing.options = [...toOptions(existing.options), ...normalizedLegacyOptions];
            continue;
        }

        subcommands.push({
            name: subcommandName,
            options: normalizedLegacyOptions,
        });
    }

    return subcommands;
}

function optionArgCount(option: OptionSpec): number {
    if (!option.args) return 0;
    return Array.isArray(option.args) ? option.args.length : 1;
}

function subcommandArgCount(subcommand: SubcommandSpec): number {
    if (!subcommand.args) return 0;
    return Array.isArray(subcommand.args) ? subcommand.args.length : 1;
}

function firstOptionArgName(option: OptionSpec): string | undefined {
    if (!option.args) return undefined;
    return Array.isArray(option.args) ? option.args[0]?.name : option.args.name;
}

function firstSubcommandArgName(subcommand: SubcommandSpec): string | undefined {
    if (!subcommand.args) return undefined;
    return Array.isArray(subcommand.args) ? subcommand.args[0]?.name : subcommand.args.name;
}

function optionDescription(option: PreparedOption): string | undefined {
    return option.description;
}

function subcommandDescription(subcommand: PreparedNode): string | undefined {
    return subcommand.description;
}

function normalizeOptionDescription(option: OptionSpec): string | undefined {
    const own = option.description?.trim();
    if (own) return own;
    const argName = firstOptionArgName(option);
    return argName ? `arg: ${argName}` : undefined;
}

function normalizeSubcommandDescription(subcommand: SubcommandSpec): string | undefined {
    const own = subcommand.description?.trim();
    if (own) return own;
    const argName = firstSubcommandArgName(subcommand);
    return argName ? `arg: ${argName}` : undefined;
}

function prepareOption(option: OptionSpec): PreparedOption | undefined {
    const names = dedupe(namesOf(option.name));
    if (!names.length) return undefined;
    return {
        names,
        primary: names[0],
        description: normalizeOptionDescription(option),
        argCount: optionArgCount(option),
        providers: option.providers ?? [],
        isRepeatable: !!option.isRepeatable,
    };
}

function prepareNode(node: SubcommandSpec): PreparedNode | undefined {
    const names = dedupe(namesOf(node.name));
    if (!names.length) return undefined;

    const subcommands: PreparedNode[] = [];
    for (const sub of toSubcommands(node.subcommands)) {
        const prepared = prepareNode(sub);
        if (prepared) subcommands.push(prepared);
    }

    const options: PreparedOption[] = [];
    for (const opt of toOptions(node.options)) {
        const prepared = prepareOption(opt);
        if (prepared) options.push(prepared);
    }

    const subByAlias = new Map<string, PreparedNode>();
    for (const sub of subcommands) {
        for (const alias of sub.names) {
            subByAlias.set(alias.toLowerCase(), sub);
        }
    }

    const optionByAlias = new Map<string, PreparedOption>();
    for (const option of options) {
        for (const alias of option.names) {
            optionByAlias.set(alias.toLowerCase(), option);
        }
    }

    return {
        names,
        primary: names[0],
        description: normalizeSubcommandDescription(node),
        argCount: subcommandArgCount(node),
        providers: node.providers ?? [],
        subcommands,
        options,
        subByAlias,
        optionByAlias,
    };
}

export class SpecCommandSuggestor implements TerminalAutocompleteSuggestorContract {
    readonly id = "spec-command";
    readonly inputPattern = /.+/;
    private readonly _providers = new Map<string, SpecSuggestionProvider>();
    private readonly _commandNamesByShell = new Map<string, Promise<ShellScopedCommand[]>>();
    private readonly _preparedSpecByCommand = new Map<string, PreparedSpec>();

    constructor(
        private readonly registry: CommandSpecSource,
        providers: SpecSuggestionProvider[] = [],
    ) {
        for (const provider of providers) {
            this._providers.set(provider.id, provider);
        }
    }

    matches(context: AutocompleteQueryContextContract): boolean {
        return (
            context.mode === "command" ||
            context.mode === "cd"
        ) && this.inputPattern.test(context.beforeCursor);
    }

    async warmUpForShellIntegration(shellType: ShellTypeContract): Promise<void> {
        await this.commandsForShellType(shellType);
    }

    async suggest(context: AutocompleteQueryContextContract): Promise<AutocompleteSuggestionContract[]> {
        if (context.mode === "cd") {
            return this.suggestCommandArgs("cd", context.fragment, context.replaceStart, context);
        }

        if (context.mode !== "command") return [];
        const parsed = this.parseTokens(context.beforeCursor);
        if (parsed.tokens.length === 0) return [];

        if (parsed.activeTokenIndex === 0) {
            return this.suggestCommandNames(parsed.activeValue, parsed.activeStart, parsed.activeEnd, context);
        }

        const commandToken = parsed.tokens[0];
        const command = commandToken?.value;
        if (!commandToken || !command) return [];
        const argsInput = context.beforeCursor.slice(commandToken.end);
        const replaceBase = commandToken.end;
        return this.suggestCommandArgs(command, argsInput, replaceBase, context);
    }

    private async suggestCommandNames(
        query: string,
        replaceStart: number,
        replaceEnd: number,
        context: AutocompleteQueryContextContract
    ): Promise<AutocompleteSuggestionContract[]> {
        const queryLower = query.toLowerCase();
        const commands = await this.commandsForShell(context);
        const suggestions: AutocompleteSuggestionContract[] = [];

        for (const c of commands) {
            if (queryLower && !c.lower.includes(queryLower)) continue;
            const starts = c.lower.startsWith(queryLower);
            suggestions.push({
                label: c.name,
                description: c.description,
                insertText: c.name,
                score: starts ? 135 : 70,
                source: "spec-cmd",
                replaceStart,
                replaceEnd,
            });
        }

        return suggestions;
    }

    private async suggestCommandArgs(
        command: string,
        argsInput: string,
        replaceBase: number,
        context: AutocompleteQueryContextContract,
        insertPrefix = ""
    ): Promise<AutocompleteSuggestionContract[]> {
        const spec = await this.registry.get(command);
        if (!spec || !this.isSpecAllowedInShell(spec, context)) return [];
        const prepared = this.prepareSpec(spec);

        const parsed = this.parseTokens(argsInput);
        const activeToken = parsed.activeValue.toLowerCase();
        const replaceStart = replaceBase + parsed.activeStart;
        const replaceEnd = replaceBase + parsed.activeEnd;
        const typedTokenSet = new Set(parsed.tokens.map(t => t.value.toLowerCase()));
        const traverse = this.traverse(prepared.root, parsed.tokens.slice(0, parsed.activeTokenIndex));

        if (traverse.pendingArgs > 0) {
            if (traverse.pendingProviders.length > 0) {
                return this.suggestFromProviders(
                    traverse.pendingProviders,
                    parsed,
                    argsInput,
                    context,
                    command,
                    activeToken,
                    replaceStart,
                    replaceEnd,
                    typedTokenSet
                );
            }
            if (traverse.pendingArgSource === "option") {
                return [];
            }
        }

        const suggestions: AutocompleteSuggestionContract[] = [];
        const add = (
            label: string,
            source: string,
            baseScore: number,
            description: string | undefined
        ) => {
            const labelLower = label.toLowerCase();
            if (typedTokenSet.has(labelLower)) return;
            if (activeToken && !labelLower.includes(activeToken)) return;
            const starts = labelLower.startsWith(activeToken);
            const contains = labelLower.includes(activeToken);
            suggestions.push({
                label,
                description,
                insertText: `${insertPrefix}${label}`,
                score: baseScore + (starts ? 90 : contains ? 35 : 0),
                source,
                replaceStart,
                replaceEnd,
            });
        };

        if (traverse.pendingArgs > 0 && traverse.pendingArgSource === "subcommand") {
            const optionMap = new Map<string, PreparedOption>();
            for (const option of prepared.root.options) {
                optionMap.set(option.primary.toLowerCase(), option);
            }
            for (const option of traverse.node.options) {
                optionMap.set(option.primary.toLowerCase(), option);
            }

            for (const option of optionMap.values()) {
                const aliases = option.names;
                const allUsed = aliases.every(alias => traverse.usedOptionAliases.has(alias.toLowerCase()));
                if (allUsed && !option.isRepeatable) continue;
                const selected = this.pickSuggestionName(aliases, activeToken);
                add(selected, "spec-opt", 38, optionDescription(option));
            }

            return suggestions;
        }

        if (traverse.pendingArgs > 0) {
            return this.suggestFromProviders(
                traverse.pendingProviders,
                parsed,
                argsInput,
                context,
                command,
                activeToken,
                replaceStart,
                replaceEnd,
                typedTokenSet
            );
        }

        for (const sub of traverse.node.subcommands) {
            if (traverse.usedSubcommands.has(sub.primary.toLowerCase())) continue;
            const selected = this.pickSuggestionName(sub.names, activeToken);
            add(selected, "spec-sub", 45, subcommandDescription(sub));
        }

        const optionMap = new Map<string, PreparedOption>();
        for (const option of prepared.root.options) {
            optionMap.set(option.primary.toLowerCase(), option);
        }
        for (const option of traverse.node.options) {
            optionMap.set(option.primary.toLowerCase(), option);
        }

        for (const option of optionMap.values()) {
            const aliases = option.names;
            const allUsed = aliases.every(alias => traverse.usedOptionAliases.has(alias.toLowerCase()));
            if (allUsed && !option.isRepeatable) continue;
            const selected = this.pickSuggestionName(aliases, activeToken);
            add(selected, "spec-opt", 38, optionDescription(option));
        }

        const providerSuggestions = await this.suggestFromProviders(
            prepared.globalProviders,
            parsed,
            argsInput,
            context,
            command,
            activeToken,
            replaceStart,
            replaceEnd,
            typedTokenSet,
            insertPrefix
        );
        suggestions.push(...providerSuggestions);

        return suggestions;
    }

    private async suggestFromProviders(
        bindings: SpecProviderBinding[],
        parsed: ParsedInput,
        argsInput: string,
        context: AutocompleteQueryContextContract,
        command: string,
        activeToken: string,
        replaceStart: number,
        replaceEnd: number,
        typedTokenSet: Set<string>,
        insertPrefix = ""
    ): Promise<AutocompleteSuggestionContract[]> {
        const suggestions: AutocompleteSuggestionContract[] = [];
        const add = (
            label: string,
            source: string,
            baseScore: number
        ) => {
            const labelLower = label.toLowerCase();
            if (typedTokenSet.has(labelLower)) return;
            if (activeToken && !labelLower.includes(activeToken)) return;
            const starts = labelLower.startsWith(activeToken);
            const contains = labelLower.includes(activeToken);
            suggestions.push({
                label,
                insertText: `${insertPrefix}${label}`,
                score: baseScore + (starts ? 90 : contains ? 35 : 0),
                source,
                replaceStart,
                replaceEnd,
            });
        };

        for (const binding of bindings) {
            const provider = this._providers.get(binding.providerId);
            if (!provider || !this.matchesProviderBinding(binding, parsed, argsInput)) continue;
            const provided = await provider.suggest({
                queryContext: context,
                command,
                args: parsed.tokens.map(t => t.value),
                binding,
            });
            for (const value of provided) {
                const label = value.label.trim();
                if (!label) continue;
                const source = binding.source ?? binding.providerId;
                const baseScore = binding.baseScore ?? 55;
                const labelLower = label.toLowerCase();
                if (typedTokenSet.has(labelLower)) continue;
                if (activeToken && !labelLower.includes(activeToken)) continue;
                const starts = labelLower.startsWith(activeToken);
                const contains = labelLower.includes(activeToken);
                suggestions.push({
                    label,
                    description: value.description,
                    insertText: `${insertPrefix}${value.insertText ?? label}`,
                    score: baseScore + (starts ? 90 : contains ? 35 : 0),
                    source,
                    replaceStart,
                    replaceEnd,
                    selectedPath: value.selectedPath,
                    completionBehavior: value.completionBehavior,
                });
            }
        }

        return suggestions;
    }

    private traverse(root: PreparedNode, committedTokens: Array<{ value: string; start: number; end: number }>): TraverseState {
        const state: TraverseState = {
            node: root,
            usedSubcommands: new Set<string>(),
            usedOptionAliases: new Set<string>(),
            pendingArgs: 0,
            pendingProviders: [],
            pendingArgSource: undefined,
        };

        for (const token of committedTokens) {
            const tokenLower = token.value.toLowerCase();

            if (state.pendingArgs > 0) {
                state.pendingArgs -= 1;
                if (state.pendingArgs === 0) {
                    state.pendingProviders = [];
                    state.pendingArgSource = undefined;
                }
                continue;
            }

            const matchedSub = state.node.subByAlias.get(tokenLower);
            if (matchedSub) {
                state.usedSubcommands.add(matchedSub.primary.toLowerCase());
                state.node = matchedSub;
                state.pendingArgs = matchedSub.argCount;
                state.pendingProviders = matchedSub.providers;
                state.pendingArgSource = matchedSub.argCount > 0 ? "subcommand" : undefined;
                continue;
            }

            const matchedOption = state.node.optionByAlias.get(tokenLower) ?? root.optionByAlias.get(tokenLower);
            if (matchedOption) {
                for (const alias of matchedOption.names) {
                    state.usedOptionAliases.add(alias.toLowerCase());
                }
                state.pendingArgs = matchedOption.argCount;
                state.pendingProviders = matchedOption.providers;
                state.pendingArgSource = matchedOption.argCount > 0 ? "option" : undefined;
            }
        }

        return state;
    }

    private pickSuggestionName(names: string[], activeToken: string): string {
        if (!activeToken) return names[0];
        const lowered = activeToken.toLowerCase();
        return names.find(n => n.toLowerCase().startsWith(lowered))
            ?? names.find(n => n.toLowerCase().includes(lowered))
            ?? names[0];
    }

    private matchesProviderBinding(binding: SpecProviderBinding, parsed: ParsedInput, argsInput: string): boolean {
        const when = binding.when;
        if (!when) return true;

        if (when.minArgs !== undefined && parsed.tokens.length < when.minArgs) return false;
        if (when.maxArgs !== undefined && parsed.tokens.length > when.maxArgs) return false;

        if (when.firstArgIn?.length) {
            const firstArg = parsed.tokens[0]?.value.toLowerCase() ?? "";
            const accepted = when.firstArgIn.map(v => v.toLowerCase());
            if (!accepted.includes(firstArg)) return false;
        }

        if (when.argsRegex) {
            const re = new RegExp(when.argsRegex, "i");
            if (!re.test(argsInput)) return false;
        }

        return true;
    }

    private isSpecAllowedInShell(spec: CommandSpec | undefined, context: AutocompleteQueryContextContract): boolean {
        if (!spec) return false;
        const shell = context.shellContext.shellType;
        if (spec.shells?.length && !spec.shells.includes(shell)) return false;
        if (spec.excludeShells?.includes(shell)) return false;
        return true;
    }

    private commandsForShell(context: AutocompleteQueryContextContract): Promise<ShellScopedCommand[]> {
        return this.commandsForShellType(context.shellContext.shellType);
    }

    private commandsForShellType(shellType: ShellConstraint): Promise<ShellScopedCommand[]> {
        const shell = shellType;
        const cached = this._commandNamesByShell.get(shell);
        if (cached) return cached;

        const next = Promise.resolve(this.registry.commandNames())
            .then(async names => {
                const scoped: ShellScopedCommand[] = [];
                for (const name of names) {
                    const constraints = await Promise.resolve(this.registry.getConstraints(name));
                    if (constraints?.shells?.length && !constraints.shells.includes(shell)) continue;
                    if (constraints?.excludeShells?.includes(shell)) continue;
                    scoped.push({
                        name,
                        lower: name.toLowerCase(),
                        description: constraints?.description,
                    });
                }
                return scoped;
            });
        this._commandNamesByShell.set(shell, next);
        return next;
    }

    private prepareSpec(spec: CommandSpec): PreparedSpec {
        const cached = this._preparedSpecByCommand.get(spec.name);
        if (cached) return cached;

        const rootSource: SubcommandSpec = {
            name: ROOT_NAME,
            description: spec.description,
            options: toOptions(spec.options),
            subcommands: mergeLegacySubcommandOptions(spec),
        };
        const root = prepareNode(rootSource) ?? {
            names: [ROOT_NAME],
            primary: ROOT_NAME,
            description: spec.description,
            argCount: 0,
            providers: [],
            subcommands: [],
            options: [],
            subByAlias: new Map<string, PreparedNode>(),
            optionByAlias: new Map<string, PreparedOption>(),
        };
        const prepared = {
            root,
            globalProviders: spec.providers ?? [],
        };
        this._preparedSpecByCommand.set(spec.name, prepared);
        return prepared;
    }

    private parseTokens(input: string): ParsedInput {
        const tokens: Array<{ value: string; start: number; end: number }> = [];
        const re = /\S+/g;
        let match: RegExpExecArray | null;
        while ((match = re.exec(input)) !== null) {
            tokens.push({
                value: match[0],
                start: match.index,
                end: match.index + match[0].length,
            });
        }

        const trailingSpace = /\s$/.test(input);
        if (tokens.length === 0) {
            return {
                tokens,
                activeTokenIndex: 0,
                activeStart: input.length,
                activeEnd: input.length,
                activeValue: "",
            };
        }

        if (trailingSpace) {
            return {
                tokens,
                activeTokenIndex: tokens.length,
                activeStart: input.length,
                activeEnd: input.length,
                activeValue: "",
            };
        }

        const active = tokens[tokens.length - 1];
        return {
            tokens,
            activeTokenIndex: tokens.length - 1,
            activeStart: active.start,
            activeEnd: active.end,
            activeValue: active.value,
        };
    }
}
