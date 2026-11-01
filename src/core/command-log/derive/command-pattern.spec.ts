import { describe, expect, it } from "vitest";
import { analyzeCommand, classifyTokens, tokenizeCommand } from "./command-pattern";

describe("analyzeCommand", () => {
  it("analyzes a plain variable command", () => {
    const result = analyzeCommand("codex resume abc123");
    expect(result).not.toBeUndefined();
    expect(result?.variableSlotCount).toBe(1);
  });

  it("returns undefined for piped commands (bash/zsh)", () => {
    expect(analyzeCommand("git log | grep foo")).toBeUndefined();
    expect(analyzeCommand("cat file.txt | sort | uniq")).toBeUndefined();
  });

  it("returns undefined for && chained commands", () => {
    expect(analyzeCommand("npm test && npm run lint")).toBeUndefined();
    expect(analyzeCommand("git add . && git commit -m 'msg'")).toBeUndefined();
  });

  it("returns undefined for || chained commands", () => {
    expect(analyzeCommand("npm test || echo failed")).toBeUndefined();
  });

  it("returns undefined for semicolon-separated commands", () => {
    expect(analyzeCommand("cd /tmp ; ls")).toBeUndefined();
  });

  it("returns undefined for redirect operators", () => {
    expect(analyzeCommand("echo foo > output.txt")).toBeUndefined();
    expect(analyzeCommand("sort < input.txt")).toBeUndefined();
    expect(analyzeCommand("echo foo >> log.txt")).toBeUndefined();
  });

  it("returns undefined for PowerShell piped commands", () => {
    expect(analyzeCommand("Get-Process | Select-Object Name")).toBeUndefined();
  });

  it("returns undefined for PowerShell script blocks", () => {
    expect(analyzeCommand("ForEach-Object { $_ }")).toBeUndefined();
    expect(analyzeCommand("Get-ChildItem | Where-Object { $_.Name -like '*.ts' }")).toBeUndefined();
  });

  it("does not reject commands with flag-like tokens containing special chars", () => {
    expect(analyzeCommand("git commit -am 'fix bug'")).not.toBeUndefined();
    expect(analyzeCommand("docker run --rm ubuntu bash")).not.toBeUndefined();
  });

  it("does not reject simple commands without operators", () => {
    expect(analyzeCommand("codex resume abc123")).not.toBeUndefined();
    expect(analyzeCommand("npm run build")).not.toBeUndefined();
    expect(analyzeCommand("ssh user@server.example.com")).not.toBeUndefined();
  });
});

describe("classifyTokens", () => {
  const kinds = (command: string) => classifyTokens(tokenizeCommand(command)).map((t) => t.kind);

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
