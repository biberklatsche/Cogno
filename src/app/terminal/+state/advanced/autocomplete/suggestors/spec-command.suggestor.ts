import { AutocompleteSuggestion, QueryContext } from "../autocomplete.types";
import { TerminalAutocompleteSuggestor } from "./terminal-autocomplete.suggestor";
import { CommandSpecRegistry } from "../spec/command-spec.registry";
import { SpecSuggestionProvider } from "../spec/spec.types";

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
        providers: SpecSuggestionProvider[] = []
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
            return this.suggestCommandNames(parsed.activeValue, parsed.activeStart, parsed.activeEnd);
        }

        const command = parsed.tokens[0]?.value;
        if (!command) return [];
        const argsInput = context.beforeCursor.slice(command.length + 1);
        const replaceBase = command.length + 1;
        return this.suggestCommandArgs(command, argsInput, replaceBase, context);
    }

    private suggestCommandNames(query: string, replaceStart: number, replaceEnd: number): AutocompleteSuggestion[] {
        const queryLower = query.toLowerCase();
        return this.registry.commandNames()
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

        const suggestions: AutocompleteSuggestion[] = [];
        const add = (label: string, source: string, baseScore: number, kind: "command" | "script" = "command") => {
            if (activeToken && !label.toLowerCase().includes(activeToken)) return;
            const starts = label.toLowerCase().startsWith(activeToken);
            const contains = label.toLowerCase().includes(activeToken);
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

        if (spec.scriptProviderId) {
            const provider = this._providers.get(spec.scriptProviderId);
            if (provider && this.shouldOfferScripts(command, parsed)) {
                const scripts = await provider.suggest({ queryContext: context, command, args: parsed.tokens.map(t => t.value) });
                for (const script of scripts) {
                    add(script, "npm-script", 55, "script");
                }
            }
        }

        return suggestions;
    }

    private shouldOfferScripts(command: string, parsed: ParsedInput): boolean {
        if (command !== "npm") return false;
        if (parsed.tokens.length === 0) return true;
        const first = parsed.tokens[0]?.value;
        if (!first) return true;
        const activeIsFirst = parsed.activeTokenIndex === 0;
        if (activeIsFirst) return true;
        return first === "run" || first === "run-script";
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

