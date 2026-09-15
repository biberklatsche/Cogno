import { describe, expect, it } from "vitest";
import { CommandPatternAnalyzer } from "./command-pattern-analyzer";
import { CommandSignatureBuilder } from "./command-signature-builder";
import { CommandTokenClassifier } from "./command-token-classifier";
import { CommandTokenizer } from "./command-tokenizer";

function makeAnalyzer() {
  return new CommandPatternAnalyzer(
    new CommandTokenizer(),
    new CommandTokenClassifier(),
    new CommandSignatureBuilder(),
  );
}

describe("CommandPatternAnalyzer.analyzeCommand", () => {
  const analyzer = makeAnalyzer();

  it("analyzes a plain variable command", () => {
    const result = analyzer.analyzeCommand("codex resume abc123");
    expect(result).not.toBeUndefined();
    expect(result?.variableSlotCount).toBe(1);
  });

  it("returns undefined for piped commands (bash/zsh)", () => {
    expect(analyzer.analyzeCommand("git log | grep foo")).toBeUndefined();
    expect(analyzer.analyzeCommand("cat file.txt | sort | uniq")).toBeUndefined();
  });

  it("returns undefined for && chained commands", () => {
    expect(analyzer.analyzeCommand("npm test && npm run lint")).toBeUndefined();
    expect(analyzer.analyzeCommand("git add . && git commit -m 'msg'")).toBeUndefined();
  });

  it("returns undefined for || chained commands", () => {
    expect(analyzer.analyzeCommand("npm test || echo failed")).toBeUndefined();
  });

  it("returns undefined for semicolon-separated commands", () => {
    expect(analyzer.analyzeCommand("cd /tmp ; ls")).toBeUndefined();
  });

  it("returns undefined for redirect operators", () => {
    expect(analyzer.analyzeCommand("echo foo > output.txt")).toBeUndefined();
    expect(analyzer.analyzeCommand("sort < input.txt")).toBeUndefined();
    expect(analyzer.analyzeCommand("echo foo >> log.txt")).toBeUndefined();
  });

  it("returns undefined for PowerShell piped commands", () => {
    expect(analyzer.analyzeCommand("Get-Process | Select-Object Name")).toBeUndefined();
  });

  it("returns undefined for PowerShell script blocks", () => {
    expect(analyzer.analyzeCommand("ForEach-Object { $_ }")).toBeUndefined();
    expect(
      analyzer.analyzeCommand("Get-ChildItem | Where-Object { $_.Name -like '*.ts' }"),
    ).toBeUndefined();
  });

  it("does not reject commands with flag-like tokens containing special chars", () => {
    expect(analyzer.analyzeCommand("git commit -am 'fix bug'")).not.toBeUndefined();
    expect(analyzer.analyzeCommand("docker run --rm ubuntu bash")).not.toBeUndefined();
  });

  it("does not reject simple commands without operators", () => {
    expect(analyzer.analyzeCommand("codex resume abc123")).not.toBeUndefined();
    expect(analyzer.analyzeCommand("npm run build")).not.toBeUndefined();
    expect(analyzer.analyzeCommand("ssh user@server.example.com")).not.toBeUndefined();
  });
});
