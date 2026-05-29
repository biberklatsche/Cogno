import { describe, expect, it } from "vitest";

import { CommandTokenClassifier } from "./command-token-classifier";
import { CommandTokenizer } from "./command-tokenizer";

describe("CommandTokenClassifier", () => {
  const commandTokenizer = new CommandTokenizer();
  const commandTokenClassifier = new CommandTokenClassifier();

  const kinds = (command: string) =>
    commandTokenClassifier.classify(commandTokenizer.tokenize(command)).map((t) => t.kind);

  it("keeps command name and first subcommand/verb stable", () => {
    expect(kinds("git commit")).toEqual(["stable", "stable"]);
  });

  it("keeps option flags stable regardless of position", () => {
    expect(kinds("git commit --amend")).toEqual(["stable", "stable", "stable"]);
    expect(kinds("tool deploy --value foo")).toEqual(["stable", "stable", "stable", "variable"]);
  });

  it("classifies option-bound values as variable", () => {
    expect(kinds('tool publish --value "ship it"')).toEqual([
      "stable",
      "stable",
      "stable",
      "variable",
    ]);
  });

  it("classifies bare positional arguments at index >= 2 as variable", () => {
    // codex resume <id> — id has no preceding option flag but is still a variable arg
    expect(kinds("codex resume abc123")).toEqual(["stable", "stable", "variable"]);
    // git push <remote> <branch> — both are positional variables
    expect(kinds("git push origin main")).toEqual(["stable", "stable", "variable", "variable"]);
    // npm run <script> — script name is variable
    expect(kinds("npm run build")).toEqual(["stable", "stable", "variable"]);
  });

  it("classifies subcommand-like tokens consistently — variance checks suppress unhelpful patterns", () => {
    // "add" at index 2 would be a slot, but if always "add" the pattern is filtered by dominance ratio
    expect(kinds("git remote add origin https://example.com/repo.git")).toEqual([
      "stable",
      "stable",
      "variable",
      "variable",
      "variable",
    ]);
  });

  it("classifies index-1 tokens with special characters as variable (paths, hosts, URLs, filenames)", () => {
    expect(kinds("ssh user@server.example.com")).toEqual(["stable", "variable"]);
    expect(kinds("curl https://api.example.com/v1")).toEqual(["stable", "variable"]);
    expect(kinds("node script.js")).toEqual(["stable", "variable"]);
    expect(kinds("python ./run.py")).toEqual(["stable", "variable"]);
    expect(kinds("scp /etc/hosts")).toEqual(["stable", "variable"]);
  });

  it("keeps index-1 pure-alphabetic tokens stable (subcommands and plain words)", () => {
    expect(kinds("git commit")).toEqual(["stable", "stable"]);
    expect(kinds("npm run")).toEqual(["stable", "stable"]);
    expect(kinds("docker exec")).toEqual(["stable", "stable"]);
    expect(kinds("man ls")).toEqual(["stable", "stable"]);
  });
});
