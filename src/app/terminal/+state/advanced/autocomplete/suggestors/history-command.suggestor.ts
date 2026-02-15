import { TerminalHistoryPersistenceService } from "../../history/terminal-history-persistence.service";
import { AutocompleteSuggestion, QueryContext } from "../autocomplete.types";
import { TerminalAutocompleteSuggestor } from "./terminal-autocomplete.suggestor";

const SAME_COMMAND_TOKEN_BOOST = 120;

function firstToken(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";
    const idx = trimmed.search(/\s/);
    return (idx === -1 ? trimmed : trimmed.slice(0, idx)).toLowerCase();
}

function tokenizeWords(input: string): string[] {
    return input
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

function consistsOnlyOfPromptWords(command: string, promptWords: Set<string>): boolean {
    const words = tokenizeWords(command);
    return words.length > 0 && words.every(word => promptWords.has(word));
}

export class HistoryCommandSuggestor implements TerminalAutocompleteSuggestor {
    readonly id = "history-command";
    readonly inputPattern = /.+/;

    constructor(private readonly persistence: TerminalHistoryPersistenceService) {}

    matches(context: QueryContext): boolean {
        return (context.mode === "command" || context.mode === "npm-script") && this.inputPattern.test(context.beforeCursor);
    }

    async suggest(context: QueryContext): Promise<AutocompleteSuggestion[]> {
        const query = context.mode === "npm-script" ? "npm" : context.mode === "command" ? context.query : "";
        if (!query) return [];

        const rows = await this.persistence.searchCommands(query, 100);
        const queryLower = query.toLowerCase();
        const inputCommandToken = firstToken(context.inputText);
        const promptWords = new Set(tokenizeWords(context.inputText));

        return rows
            .filter(row => !consistsOnlyOfPromptWords(row.command, promptWords))
            .map(row => {
            const textLower = row.command.toLowerCase();
            const starts = textLower.startsWith(queryLower);
            const contains = textLower.includes(queryLower);
            const rowCommandToken = firstToken(row.command);
            const sameCommand = !!inputCommandToken && rowCommandToken === inputCommandToken;
            const score = row.selectCount * 25
                + row.execCount * 8
                + (starts ? 70 : contains ? 20 : 0)
                + (sameCommand ? SAME_COMMAND_TOKEN_BOOST : 0);

            return {
                label: row.command,
                detail: `exec: ${row.execCount}, selected: ${row.selectCount}`,
                insertText: row.command,
                score,
                source: "history-cmd",
                kind: "command",
                // History commands must replace the entire terminal input.
                replaceStart: 0,
                replaceEnd: context.inputText.length,
                selectedCommand: row.command,
            };
            });
    }
}
