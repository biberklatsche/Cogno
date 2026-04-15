import { describe, expect, it } from "vitest";

import type { AutocompleteSuggestion, QueryContext } from "./autocomplete.types";
import { SuggestionHighlighter } from "./suggestion-highlighter";

function makeContext(inputText: string): QueryContext {
  return {
    mode: "command",
    beforeCursor: inputText,
    inputText,
    cursorIndex: inputText.length,
    replaceStart: 0,
    replaceEnd: inputText.length,
    cwd: "/tmp",
    shellContext: { shellType: "Bash", backendOs: "linux" } as any,
    query: inputText,
  };
}

function makeSuggestion(label: string): AutocompleteSuggestion {
  return {
    label,
    insertText: label,
    score: 1,
    source: "test",
    replaceStart: 0,
    replaceEnd: label.length,
  };
}

describe("SuggestionHighlighter", () => {
  const highlighter = new SuggestionHighlighter();

  it("highlights every token from inputText in label", () => {
    const result = highlighter.apply(
      [makeSuggestion("git status --short")],
      makeContext("git status --short"),
    );

    expect(result[0].matchRanges).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 10 },
      { start: 11, end: 18 },
    ]);
  });

  it("is case-insensitive and highlights repeated occurrences", () => {
    const result = highlighter.apply([makeSuggestion("NPM test npm run")], makeContext("npm"));

    expect(result[0].matchRanges).toEqual([
      { start: 0, end: 3 },
      { start: 9, end: 12 },
    ]);
  });

  it("merges overlapping token ranges", () => {
    const result = highlighter.apply([makeSuggestion("status")], makeContext("sta status"));

    expect(result[0].matchRanges).toEqual([{ start: 0, end: 6 }]);
  });

  it("returns unchanged suggestions when inputText has no token", () => {
    const input = [makeSuggestion("git status")];
    const result = highlighter.apply(input, makeContext("   "));

    expect(result).toEqual(input);
  });
});
