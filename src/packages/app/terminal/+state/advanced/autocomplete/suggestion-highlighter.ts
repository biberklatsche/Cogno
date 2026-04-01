import { AutocompleteMatchRange, AutocompleteSuggestion, QueryContext } from "./autocomplete.types";

export class SuggestionHighlighter {
    apply(items: AutocompleteSuggestion[], context: QueryContext): AutocompleteSuggestion[] {
        const tokens = this.extractTokens(context.inputText);
        if (tokens.length === 0) return items;

        return items.map(item => ({
            ...item,
            matchRanges: this.findMatchRanges(item.label, tokens),
        }));
    }

    private extractTokens(inputText: string): string[] {
        if (!inputText) return [];
        const seen = new Set<string>();
        const tokens: string[] = [];
        for (const token of inputText.trim().split(/\s+/)) {
            if (!token) continue;
            const normalized = token.toLowerCase();
            if (seen.has(normalized)) continue;
            seen.add(normalized);
            tokens.push(normalized);
        }
        return tokens;
    }

    private findMatchRanges(label: string, tokens: string[]): AutocompleteMatchRange[] {
        if (!label || tokens.length === 0) return [];

        const haystack = label.toLowerCase();
        const rawRanges: AutocompleteMatchRange[] = [];

        for (const token of tokens) {
            let from = 0;
            while (from < haystack.length) {
                const idx = haystack.indexOf(token, from);
                if (idx < 0) break;
                rawRanges.push({ start: idx, end: idx + token.length });
                from = idx + token.length;
            }
        }

        if (rawRanges.length === 0) return [];

        rawRanges.sort((a, b) => (a.start - b.start) || (a.end - b.end));
        const merged: AutocompleteMatchRange[] = [];
        for (const range of rawRanges) {
            const last = merged.at(-1);
            if (!last || range.start > last.end) {
                merged.push({ ...range });
                continue;
            }
            if (range.end > last.end) {
                last.end = range.end;
            }
        }
        return merged;
    }
}


