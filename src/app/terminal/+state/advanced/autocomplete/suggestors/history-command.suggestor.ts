import { TerminalHistoryPersistenceService } from "../../history/terminal-history-persistence.service";
import { AutocompleteSuggestion, QueryContext } from "../autocomplete.types";
import { TerminalAutocompleteSuggestor } from "./terminal-autocomplete.suggestor";

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

        return rows.map(row => {
            const textLower = row.command.toLowerCase();
            const starts = textLower.startsWith(queryLower);
            const contains = textLower.includes(queryLower);
            const score = row.selectCount * 25 + row.execCount * 8 + (starts ? 70 : contains ? 20 : 0);

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
