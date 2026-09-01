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

  it("scores the collapsed suggestion below the max member score", () => {
    const suggestions = [
      historySuggestion("codex resume abc123", 100),
      historySuggestion("codex resume def456", 90),
      historySuggestion("codex resume ghi789", 80),
    ];

    const result = collapser.collapse(suggestions);
    const collapsed = result.find((s) => s.source === "history-collapse");
    expect(collapsed).toBeDefined();
    expect(collapsed!.score).toBeLessThan(100);
  });

  it("suppresses collapsed suggestion when query only matches the collapsed argument", () => {
    // "st" matches "start"/"stop"/etc. but not the stable prefix "yarn"
    const suggestions = [
      historySuggestion("yarn start", 95),
      historySuggestion("yarn stop", 90),
      historySuggestion("yarn storybook", 85),
    ];

    const result = collapser.collapse(suggestions, "st");
    const collapsed = result.filter((s) => s.source === "history-collapse");
    expect(collapsed).toHaveLength(0);
  });

  it("keeps collapsed suggestion when query matches the stable prefix", () => {
    const suggestions = [
      historySuggestion("yarn start", 95),
      historySuggestion("yarn stop", 90),
      historySuggestion("yarn storybook", 85),
    ];

    const result = collapser.collapse(suggestions, "ya");
    const collapsed = result.filter((s) => s.source === "history-collapse");
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].label).toBe("yarn {arg1}");
    expect(collapsed[0].score).toBeLessThan(95);
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

  it("scores the collapsed suggestion below the top originals so it appears after them", () => {
    const suggestions = [
      historySuggestion("codex resume abc123"),
      historySuggestion("codex resume def456"),
      historySuggestion("codex resume ghi789"),
    ];

    const result = collapser.collapse(suggestions);
    const collapsedIdx = result.findIndex((s) => s.source === "history-collapse");
    expect(collapsedIdx).toBeGreaterThan(-1);
    // Top originals (score 100) should rank above collapsed (score 90)
    const originalsBefore = result.slice(0, collapsedIdx).filter((s) => s.source === "history-cmd");
    expect(originalsBefore.length).toBeGreaterThan(0);
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

  it("collapses 2-token commands like 'echo a', 'echo b', 'echo c'", () => {
    const suggestions = [
      historySuggestion("echo a"),
      historySuggestion("echo b"),
      historySuggestion("echo c"),
    ];

    const result = collapser.collapse(suggestions);
    const collapsed = result.filter((s) => s.source === "history-collapse");
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].label).toBe("echo {arg1}");
    expect(collapsed[0].insertText).toBe("echo ");
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
