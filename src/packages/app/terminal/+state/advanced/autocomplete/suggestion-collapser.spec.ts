import { describe, expect, it } from "vitest";
import type { AutocompleteSuggestion } from "./autocomplete.types";
import { SuggestionCollapser } from "./suggestion-collapser";

function historySuggestion(label: string, score = 100): AutocompleteSuggestion {
  return {
    label,
    insertText: label,
    score,
    source: "history-cmd",
    replaceStart: 0,
    replaceEnd: label.length,
  };
}

function contextSuggestion(label: string): AutocompleteSuggestion {
  return {
    label,
    insertText: label,
    score: 50,
    source: "spec-command",
    replaceStart: 0,
    replaceEnd: label.length,
  };
}

describe("SuggestionCollapser", () => {
  const collapser = new SuggestionCollapser();

  it("collapses 3 or more history suggestions that differ at exactly one position", () => {
    const suggestions = [
      historySuggestion("codex resume abc123"),
      historySuggestion("codex resume def456"),
      historySuggestion("codex resume ghi789"),
    ];

    const result = collapser.collapse(suggestions);

    const collapsed = result.filter((s) => s.source === "history-collapse");
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].label).toBe("codex resume {arg1}");
    expect(collapsed[0].liveCollapsedFrom).toEqual(
      expect.arrayContaining(["codex resume abc123", "codex resume def456", "codex resume ghi789"]),
    );
    // insertText has no placeholder — cursor is ready to type the argument
    expect(collapsed[0].insertText).toBe("codex resume ");
    expect(collapsed[0].completionBehavior).toBe("continue");
  });

  it("does not collapse fewer than 3 similar suggestions (below threshold)", () => {
    const suggestions = [
      historySuggestion("codex resume abc123"),
      historySuggestion("codex resume def456"),
    ];

    const result = collapser.collapse(suggestions);
    expect(result.filter((s) => s.source === "history-collapse")).toHaveLength(0);
  });

  it("keeps up to 2 original suggestions from a collapsed group", () => {
    const suggestions = [
      historySuggestion("codex resume abc123", 90),
      historySuggestion("codex resume def456", 100),
      historySuggestion("codex resume ghi789", 80),
      historySuggestion("codex resume jkl012", 70),
    ];

    const result = collapser.collapse(suggestions);
    const originals = result.filter((s) => s.source === "history-cmd");
    expect(originals.length).toBeLessThanOrEqual(2);
  });

  it("does not collapse suggestions from different command families", () => {
    const suggestions = [
      historySuggestion("git push origin main"),
      historySuggestion("npm run dev"),
      historySuggestion("docker exec container bash"),
    ];

    const result = collapser.collapse(suggestions);
    expect(result.filter((s) => s.source === "history-collapse")).toHaveLength(0);
  });

  it("places the collapsed suggestion before originals", () => {
    const suggestions = [
      historySuggestion("codex resume abc123"),
      historySuggestion("codex resume def456"),
      historySuggestion("codex resume ghi789"),
    ];

    const result = collapser.collapse(suggestions);
    expect(result[0].source).toBe("history-collapse");
  });

  it("places context suggestions after all history suggestions", () => {
    const suggestions = [
      historySuggestion("codex resume abc123"),
      historySuggestion("codex resume def456"),
      historySuggestion("codex resume ghi789"),
      contextSuggestion("codex"),
    ];

    const result = collapser.collapse(suggestions);
    const lastItem = result[result.length - 1];
    expect(lastItem.source).toBe("spec-command");
  });

  it("collapses at the variable position with the highest group size", () => {
    // 3 suggestions differ at pos 2 (remote name) — should collapse there
    const suggestions = [
      historySuggestion("git push origin main"),
      historySuggestion("git push upstream main"),
      historySuggestion("git push fork main"),
    ];

    const result = collapser.collapse(suggestions);
    const collapsed = result.filter((s) => s.source === "history-collapse");
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].label).toBe("git push {arg1}");
  });

  it("does not collapse when all suggestions have identical variable positions (no variance)", () => {
    const suggestions = [
      historySuggestion("codex resume abc123"),
      historySuggestion("codex resume abc123"),
      historySuggestion("codex resume abc123"),
    ];

    const result = collapser.collapse(suggestions);
    expect(result.filter((s) => s.source === "history-collapse")).toHaveLength(0);
  });
});
