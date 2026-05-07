import { describe, expect, it } from "vitest";
import { AiCommandExtractionService } from "./ai-command-extraction.service";

describe("AiCommandExtractionService", () => {
  it("should extract shell code blocks as command suggestions", () => {
    const service = new AiCommandExtractionService();

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
        executionMode: "run_only",
        sourceMessageId: "MSG1",
        target: { terminalId: "TE123" },
      },
      {
        command: "Get-ChildItem -Force",
        language: "powershell",
        executionMode: "run_only",
        sourceMessageId: "MSG1",
        target: { terminalId: "TE123" },
      },
    ]);
  });

  it("should extract continue mode from the code fence header", () => {
    const service = new AiCommandExtractionService();

    const commands = service.extractCommands(
      "MSG3",
      ["```sh ai:continue", "npm view cogno version", "```"].join("\n"),
      { terminalId: "TE999" },
    );

    expect(commands).toEqual([
      {
        command: "npm view cogno version",
        language: "sh",
        executionMode: "run_and_continue",
        sourceMessageId: "MSG3",
        target: { terminalId: "TE999" },
      },
    ]);
  });

  it("should keep visible text unchanged while extracting executionMode from the fence header", () => {
    const service = new AiCommandExtractionService();

    const parsedResponse = service.parseAssistantResponse(
      "MSG4",
      ["Inspect the pods first.", "", "```sh ai:continue", "kubectl get pods -A", "```"].join("\n"),
      { terminalId: "TE111" },
    );

    expect(parsedResponse.displayText).toBe(
      ["Inspect the pods first.", "", "```sh ai:continue", "kubectl get pods -A", "```"].join("\n"),
    );
    expect(parsedResponse.commands).toEqual([
      {
        command: "kubectl get pods -A",
        language: "sh",
        executionMode: "run_and_continue",
        sourceMessageId: "MSG4",
        target: { terminalId: "TE111" },
      },
    ]);
  });

  it("should ignore non-shell code blocks", () => {
    const service = new AiCommandExtractionService();

    const commands = service.extractCommands(
      "MSG2",
      ["```json", '{"answer":true}', "```"].join("\n"),
      { terminalId: "TE321" },
    );

    expect(commands).toEqual([]);
  });

  it("should ignore untagged code blocks", () => {
    const service = new AiCommandExtractionService();

    const commands = service.extractCommands("MSG3", ["```", "npm run build", "```"].join("\n"), {
      terminalId: "TE456",
    });

    expect(commands).toEqual([]);
  });
});
