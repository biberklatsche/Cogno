import { AutocompleteSuggestion, QueryContext } from "../autocomplete.types";
import { TerminalAutocompleteSuggestor } from "./terminal-autocomplete.suggestor";
import { CommandSpecRegistry } from "../spec/command-spec.registry";
import { SpecProviderBinding, SpecSuggestionProvider } from "../spec/spec.types";
import { BinaryAvailabilityRanker, SpecCommandRanker } from "../spec/ranking/binary-availability.ranker";

type ParsedInput = {
    tokens: Array<{ value: string; start: number; end: number }>;
    activeTokenIndex: number;
    activeStart: number;
    activeEnd: number;
    activeValue: string;
};

export class SpecCommandSuggestor implements TerminalAutocompleteSuggestor {
    readonly id = "spec-command";
    readonly inputPattern = /.+/;
    private readonly _providers = new Map<string, SpecSuggestionProvider>();

    constructor(
        private readonly registry: CommandSpecRegistry,
        providers: SpecSuggestionProvider[] = [],
        private readonly commandRanker: SpecCommandRanker = new BinaryAvailabilityRanker(),
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
        const base = this.registry.commandNames()
            .filter(name => !queryLower || name.toLowerCase().includes(queryLower))
            .map(name => {
                const starts = name.toLowerCase().startsWith(queryLower);
                const contains = name.toLowerCase().includes(queryLower);
                return {
                    label: name,
                    detail: "spec command",
                    insertText: name,
                    score: (starts ? 95 : contains ? 30 : 0) + 40,
                    source: "spec-cmd",
                    kind: "command" as const,
                    replaceStart,
                    replaceEnd,
                };
            });

        const boosts = await Promise.all(base.map(s => this.commandRanker.boostForCommand(s.label, context)));
        return base.map((s, idx) => ({ ...s, score: s.score + (boosts[idx] ?? 0) }));
    }

    private async suggestCommandArgs(
        command: string,
        argsInput: string,
        replaceBase: number,
        context: QueryContext
    ): Promise<AutocompleteSuggestion[]> {
        const spec = this.registry.get(command);
        if (!spec) return [];

        const parsed = this.parseTokens(argsInput);
        const activeToken = parsed.activeValue.toLowerCase();
        const replaceStart = replaceBase + parsed.activeStart;
        const replaceEnd = replaceBase + parsed.activeEnd;
        const typedTokenSet = new Set(parsed.tokens.map(t => t.value.toLowerCase()));
        const selectedSubcommand = parsed.tokens[0]?.value;
        const selectedSubcommandOptions = selectedSubcommand
            ? (spec.subcommandOptions?.[selectedSubcommand] ?? spec.subcommandOptions?.[selectedSubcommand.toLowerCase()] ?? [])
            : [];

        const suggestions: AutocompleteSuggestion[] = [];
        const add = (label: string, source: string, baseScore: number, kind: "command" | "script" = "command") => {
            const labelLower = label.toLowerCase();
            if (typedTokenSet.has(labelLower)) return;
            if (activeToken && !labelLower.includes(activeToken)) return;
            const starts = labelLower.startsWith(activeToken);
            const contains = labelLower.includes(activeToken);
            suggestions.push({
                label,
                detail: source,
                insertText: label,
                score: baseScore + (starts ? 90 : contains ? 35 : 0),
                source,
                kind,
                replaceStart,
                replaceEnd,
                selectedCommand: kind === "command" ? `${command} ${label}` : undefined,
            });
        };

        for (const sub of spec.subcommands ?? []) {
            add(sub, "spec-sub", 45);
        }
        for (const opt of spec.options ?? []) {
            add(opt, "spec-opt", 38);
        }
        for (const opt of selectedSubcommandOptions) {
            add(opt, "spec-sub-opt", 42);
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
                add(value, binding.source ?? binding.providerId, binding.baseScore ?? 55, binding.kind ?? "script");
            }
        }

        return suggestions;
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
