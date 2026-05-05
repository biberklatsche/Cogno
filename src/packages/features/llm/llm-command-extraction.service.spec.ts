import { describe, expect, it } from "vitest";
import { LlmCommandExtractionService } from "./llm-command-extraction.service";

describe("LlmCommandExtractionService", () => {
  it("should extract shell code blocks as command suggestions", () => {
    const service = new LlmCommandExtractionService();

    const commands = service.extractCommands(
      "MSG1",
      [
        "Run the following commands:",
        "```sh",
        "npm run build",
        "```",
        "```powershell",
        "Get-ChildItem -Force",
        "```",
      ].join("\n"),
      { terminalId: "TE123" },
    );

    expect(commands).toEqual([
      {
        command: "npm run build",
        language: "sh",
        sourceMessageId: "MSG1",
        target: { terminalId: "TE123" },
      },
      {
        command: "Get-ChildItem -Force",
        language: "powershell",
        sourceMessageId: "MSG1",
        target: { terminalId: "TE123" },
      },
    ]);
  });

  it("should ignore non-shell code blocks", () => {
    const service = new LlmCommandExtractionService();

    const commands = service.extractCommands(
      "MSG2",
      ["```json", '{"answer":true}', "```"].join("\n"),
      { terminalId: "TE321" },
    );

    expect(commands).toEqual([]);
  });

  it("should ignore untagged code blocks", () => {
    const service = new LlmCommandExtractionService();

    const commands = service.extractCommands("MSG3", ["```", "npm run build", "```"].join("\n"), {
      terminalId: "TE456",
    });

    expect(commands).toEqual([]);
  });
});
