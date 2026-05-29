import { CommandTokenizer } from "../history/command-tokenizer";
import { AutocompleteSuggestion } from "./autocomplete.types";

const COLLAPSE_THRESHOLD = 3;
const MAX_KEPT_FROM_GROUP = 2;

type TokenizedItem = {
  suggestion: AutocompleteSuggestion;
  tokens: string[];
};

type CollapseGroup = {
  varPos: number;
  templateKey: string;
  members: TokenizedItem[];
};

export class SuggestionCollapser {
  private readonly commandTokenizer = new CommandTokenizer();

  collapse(suggestions: AutocompleteSuggestion[]): AutocompleteSuggestion[] {
    const historySuggestions = suggestions.filter((s) => this.isHistorySuggestion(s));
    const otherSuggestions = suggestions.filter((s) => !this.isHistorySuggestion(s));

    if (historySuggestions.length < COLLAPSE_THRESHOLD) {
      return suggestions;
    }

    const tokenized = historySuggestions.map((s) => ({
      suggestion: s,
      tokens: this.commandTokenizer.tokenize(s.label).map((t) => t.value),
    }));

    const groups = this.findCollapseGroups(tokenized);
    if (groups.length === 0) {
      return suggestions;
    }

    const assigned = new Set<AutocompleteSuggestion>();
    const result: AutocompleteSuggestion[] = [];

    for (const group of groups) {
      if (group.members.some((m) => assigned.has(m.suggestion))) continue;

      for (const m of group.members) assigned.add(m.suggestion);

      const collapsedSuggestion = this.buildCollapsedSuggestion(group);
      result.push(collapsedSuggestion);

      const topMembers = group.members
        .slice()
        .sort((a, b) => b.suggestion.score - a.suggestion.score)
        .slice(0, MAX_KEPT_FROM_GROUP);
      for (const m of topMembers) result.push(m.suggestion);
    }

    for (const item of tokenized) {
      if (!assigned.has(item.suggestion)) result.push(item.suggestion);
    }

    return [...result, ...otherSuggestions];
  }

  private findCollapseGroups(items: TokenizedItem[]): CollapseGroup[] {
    const byTokenCount = new Map<number, TokenizedItem[]>();
    for (const item of items) {
      const count = item.tokens.length;
      if (!byTokenCount.has(count)) byTokenCount.set(count, []);
      byTokenCount.get(count)?.push(item);
    }

    const groups: CollapseGroup[] = [];

    for (const [tokenCount, sameCountItems] of byTokenCount) {
      if (tokenCount < 3) continue;

      for (let varPos = 2; varPos < tokenCount; varPos++) {
        const byTemplate = new Map<string, TokenizedItem[]>();
        for (const item of sameCountItems) {
          const key = item.tokens.filter((_, i) => i !== varPos).join("\x00");
          if (!byTemplate.has(key)) byTemplate.set(key, []);
          byTemplate.get(key)?.push(item);
        }

        for (const [templateKey, members] of byTemplate) {
          if (members.length < COLLAPSE_THRESHOLD) continue;
          const distinctValues = new Set(members.map((m) => m.tokens[varPos]));
          if (distinctValues.size < 2) continue;
          groups.push({ varPos, templateKey, members });
        }
      }
    }

    // Largest groups first to prefer more specific collapses
    return groups.sort((a, b) => b.members.length - a.members.length);
  }

  private buildCollapsedSuggestion(group: CollapseGroup): AutocompleteSuggestion {
    const representative = group.members[0].tokens;
    const stablePrefix = representative.slice(0, group.varPos).join(" ");
    const label = `${stablePrefix} {arg1}`;
    const insertText = `${stablePrefix} `;
    const maxScore = Math.max(...group.members.map((m) => m.suggestion.score));
    const representative0 = group.members[0].suggestion;

    return {
      label,
      description: "Grouped commands — select to use as template",
      insertText,
      score: maxScore + 1,
      source: "history-collapse",
      replaceStart: representative0.replaceStart,
      replaceEnd: representative0.replaceEnd,
      completionBehavior: "continue",
      liveCollapsedFrom: [...new Set(group.members.map((m) => m.suggestion.label))],
    };
  }

  private isHistorySuggestion(suggestion: AutocompleteSuggestion): boolean {
    return suggestion.source === "history-cmd" || suggestion.source === "history-cmd-local";
  }
}
