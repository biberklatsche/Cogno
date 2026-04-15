import { describe, expect, it } from "vitest";

import { CommandTokenClassifier } from "./command-token-classifier";
import { CommandTokenizer } from "./command-tokenizer";

describe("CommandTokenClassifier", () => {
  it("classifies quoted payloads and option-bound values as variable without command-specific knowledge", () => {
    const commandTokenizer = new CommandTokenizer();
    const commandTokenClassifier = new CommandTokenClassifier();

    const classifiedOptionTokens = commandTokenClassifier.classify(
      commandTokenizer.tokenize("tool deploy --value release/candidate"),
    );
    const classifiedQuotedTokens = commandTokenClassifier.classify(
      commandTokenizer.tokenize('tool publish --value "ship it"'),
    );

    expect(classifiedOptionTokens.map((commandToken) => commandToken.kind)).toEqual([
      "stable",
      "stable",
      "stable",
      "variable",
    ]);
    expect(classifiedQuotedTokens.map((commandToken) => commandToken.kind)).toEqual([
      "stable",
      "stable",
      "stable",
      "variable",
    ]);
  });
});
