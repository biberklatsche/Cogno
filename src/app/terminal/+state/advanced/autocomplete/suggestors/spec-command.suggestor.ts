import { AutocompleteSuggestion, QueryContext } from "../autocomplete.types";
import { TerminalAutocompleteSuggestor } from "./terminal-autocomplete.suggestor";
import { CommandSpecRegistry } from "../spec/command-spec.registry";
import {
    CommandSpec,
    FigOptionSpec,
    FigSubcommandSpec,
    SpecProviderBinding,
    SpecSuggestionProvider
} from "../spec/spec.types";

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
};

type TraverseState = {
    node: FigSubcommandSpec;
    usedSubcommands: Set<string>;
    usedOptionAliases: Set<string>;
    pendingOptionArgs: number;
};

const ROOT_NAME = "__root__";

function namesOf(name: string | string[]): string[] {
    return Array.isArray(name) ? name : [name];
}

function primaryName(name: string | string[]): string {
    return namesOf(name)[0] ?? "";
}

function normalizeSubcommands(source?: Array<string | FigSubcommandSpec>): FigSubcommandSpec[] {
    if (!source?.length) return [];
    return source.map(s => {
        if (typeof s === "string") return { name: s };
        return s;
    });
}

function normalizeOptions(source?: Array<string | FigOptionSpec>): FigOptionSpec[] {
    if (!source?.length) return [];
    return source.map(s => {
        if (typeof s === "string") return { name: s };
        return s;
    });
}

function optionArgCount(option: FigOptionSpec): number {
    if (!option.args) return 0;
    return Array.isArray(option.args) ? option.args.length : 1;
}

function firstOptionArgName(option: FigOptionSpec): string | undefined {
    if (!option.args) return undefined;
    return Array.isArray(option.args) ? option.args[0]?.name : option.args.name;
}

function optionDescription(option: FigOptionSpec): string | undefined {
    const own = option.description?.trim();
    if (own) return own;
    const argName = firstOptionArgName(option);
    return argName ? `arg: ${argName}` : undefined;
}

export class SpecCommandSuggestor implements TerminalAutocompleteSuggestor {
    readonly id = "spec-command";
    readonly inputPattern = /.+/;
    private readonly _providers = new Map<string, SpecSuggestionProvider>();
    private readonly _commandNamesByShell = new Map<string, ShellScopedCommand[]>();

    constructor(
        private readonly registry: CommandSpecRegistry,
        providers: SpecSuggestionProvider[] = [],
    ) {
        for (const provider of providers) {
            this._providers.set(provider.id, provider);
        }
    }

    matches(context: QueryContext): boolean {
        return (context.mode === "command" || context.mode === "npm-script") && this.inputPattern.test(context.beforeCursor);
    }

    async suggest(context: QueryContext): Promise<AutocompleteSuggestion[]> {
        if (context.mode === "npm-script") {
            return this.suggestCommandArgs("npm", context.fragment, context.replaceStart, context);
        }

        if (context.mode !== "command") return [];
        const parsed = this.parseTokens(context.beforeCursor);
        if (parsed.tokens.length === 0) return [];

        if (parsed.activeTokenIndex === 0) {
            return this.suggestCommandNames(parsed.activeValue, parsed.activeStart, parsed.activeEnd, context);
        }

        const command = parsed.tokens[0]?.value;
        if (!command) return [];
        const argsInput = context.beforeCursor.slice(command.length + 1);
        const replaceBase = command.length + 1;
        return this.suggestCommandArgs(command, argsInput, replaceBase, context);
    }

    private async suggestCommandNames(
        query: string,
        replaceStart: number,
        replaceEnd: number,
        context: QueryContext
    ): Promise<AutocompleteSuggestion[]> {
        const queryLower = query.toLowerCase();
        const commands = this.commandsForShell(context);
        const suggestions: AutocompleteSuggestion[] = [];

        for (const c of commands) {
            if (queryLower && !c.lower.includes(queryLower)) continue;
            const starts = c.lower.startsWith(queryLower);
            const spec = this.registry.get(c.name);
            suggestions.push({
                label: c.name,
                detail: "spec command",
                description: spec?.description,
                insertText: c.name,
                score: starts ? 135 : 70,
                source: "spec-cmd",
                kind: "command" as const,
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
        context: QueryContext
    ): Promise<AutocompleteSuggestion[]> {
        const spec = this.registry.get(command);
        if (!spec || !this.isSpecAllowedInShell(spec, context)) return [];

        const parsed = this.parseTokens(argsInput);
        const activeToken = parsed.activeValue.toLowerCase();
        const replaceStart = replaceBase + parsed.activeStart;
        const replaceEnd = replaceBase + parsed.activeEnd;
        const allSubcommands = normalizeSubcommands(spec.subcommands);
        const root: FigSubcommandSpec = {
            name: ROOT_NAME,
            description: spec.description,
            options: normalizeOptions(spec.options),
            subcommands: allSubcommands,
        };

        const typedTokenSet = new Set(parsed.tokens.map(t => t.value.toLowerCase()));
        const traverse = this.traverseTree(root, parsed.tokens.slice(0, parsed.activeTokenIndex));

        // If user is typing an argument for a preceding option, don't inject unrelated command tokens.
        if (traverse.pendingOptionArgs > 0 && activeToken && !activeToken.startsWith("-")) {
            return [];
        }

        const suggestions: AutocompleteSuggestion[] = [];
        const add = (
            label: string,
            source: string,
            baseScore: number,
            description: string | undefined,
            kind: "command" | "script" = "command"
        ) => {
            const labelLower = label.toLowerCase();
            if (typedTokenSet.has(labelLower)) return;
            if (activeToken && !labelLower.includes(activeToken)) return;
            const starts = labelLower.startsWith(activeToken);
            const contains = labelLower.includes(activeToken);
            suggestions.push({
                label,
                detail: source,
                description,
                insertText: label,
                score: baseScore + (starts ? 90 : contains ? 35 : 0),
                source,
                kind,
                replaceStart,
                replaceEnd,
                selectedCommand: kind === "command" ? `${command} ${label}` : undefined,
            });
        };

        for (const sub of normalizeSubcommands(traverse.node.subcommands)) {
            const subNames = namesOf(sub.name);
            if (!subNames.length) continue;
            const canonical = primaryName(sub.name).toLowerCase();
            if (traverse.usedSubcommands.has(canonical)) continue;
            const selected = this.pickSuggestionName(subNames, activeToken);
            add(selected, "spec-sub", 45, sub.description);
        }

        const optionMap = new Map<string, FigOptionSpec>();
        for (const option of [
            ...normalizeOptions(root.options),
            ...normalizeOptions(traverse.node.options),
        ]) {
            const key = primaryName(option.name).toLowerCase();
            if (!optionMap.has(key)) optionMap.set(key, option);
        }

        for (const option of optionMap.values()) {
            const aliases = namesOf(option.name).map(v => v.trim()).filter(Boolean);
            if (!aliases.length) continue;
            const allUsed = aliases.every(alias => traverse.usedOptionAliases.has(alias.toLowerCase()));
            if (allUsed && !option.isRepeatable) continue;
            const selected = this.pickSuggestionName(aliases, activeToken);
            add(selected, "spec-opt", 38, optionDescription(option));
        }

        for (const binding of spec.providers ?? []) {
            const provider = this._providers.get(binding.providerId);
            if (!provider || !this.matchesProviderBinding(binding, parsed, argsInput)) continue;
            const provided = await provider.suggest({
                queryContext: context,
                command,
                args: parsed.tokens.map(t => t.value),
            });
            for (const value of provided) {
                add(value, binding.source ?? binding.providerId, binding.baseScore ?? 55, undefined, binding.kind ?? "script");
            }
        }

        return suggestions;
    }

    private pickSuggestionName(names: string[], activeToken: string): string {
        if (!activeToken) return names[0];
        const lowered = activeToken.toLowerCase();
        return names.find(n => n.toLowerCase().startsWith(lowered))
            ?? names.find(n => n.toLowerCase().includes(lowered))
            ?? names[0];
    }

    private traverseTree(root: FigSubcommandSpec, committedTokens: Array<{ value: string; start: number; end: number }>): TraverseState {
        const state: TraverseState = {
            node: root,
            usedSubcommands: new Set<string>(),
            usedOptionAliases: new Set<string>(),
            pendingOptionArgs: 0,
        };

        for (const token of committedTokens) {
            const tokenLower = token.value.toLowerCase();

            if (state.pendingOptionArgs > 0) {
                state.pendingOptionArgs -= 1;
                continue;
            }

            const subs = normalizeSubcommands(state.node.subcommands);
            const matchedSub = subs.find(sub =>
                namesOf(sub.name).some(n => n.toLowerCase() === tokenLower)
            );
            if (matchedSub) {
                const canonical = primaryName(matchedSub.name).toLowerCase();
                state.usedSubcommands.add(canonical);
                state.node = matchedSub;
                continue;
            }

            const options = [
                ...normalizeOptions(root.options),
                ...normalizeOptions(state.node.options),
            ];
            const matchedOption = options.find(option =>
                namesOf(option.name).some(n => n.toLowerCase() === tokenLower)
            );
            if (matchedOption) {
                for (const alias of namesOf(matchedOption.name)) {
                    state.usedOptionAliases.add(alias.toLowerCase());
                }
                state.pendingOptionArgs = optionArgCount(matchedOption);
            }
        }

        return state;
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

    private isSpecAllowedInShell(spec: CommandSpec | undefined, context: QueryContext): boolean {
        if (!spec) return false;
        const shell = context.shellContext.shellType;
        if (spec.shells?.length && !spec.shells.includes(shell)) return false;
        if (spec.excludeShells?.includes(shell)) return false;
        return true;
    }

    private commandsForShell(context: QueryContext): ShellScopedCommand[] {
        const shell = context.shellContext.shellType;
        const cached = this._commandNamesByShell.get(shell);
        if (cached) return cached;

        const next: ShellScopedCommand[] = this.registry.commandNames()
            .filter(name => this.isSpecAllowedInShell(this.registry.get(name), context))
            .map(name => ({ name, lower: name.toLowerCase() }));
        this._commandNamesByShell.set(shell, next);
        return next;
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
