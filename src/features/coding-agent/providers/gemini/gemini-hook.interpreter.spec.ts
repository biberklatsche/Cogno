import { describe, expect, it } from "vitest";
import { interpretGeminiHook } from "./gemini-hook.interpreter";

describe("interpretGeminiHook", () => {
  it("reads the prompt, a tool call and the response by Gemini's field names", () => {
    expect(interpretGeminiHook("BeforeAgent", "working", { prompt: "Write docs" })).toEqual({
      kind: "status",
      status: "working",
      sessionBoundary: false,
      details: { task: "Write docs" },
    });
    expect(
      interpretGeminiHook("BeforeTool", "working", {
        tool_name: "run_shell_command",
        tool_input: { command: "ls", description: "List files" },
      }),
    ).toMatchObject({ details: { activity: "run_shell_command: List files" } });
    expect(
      interpretGeminiHook("AfterAgent", "ready", { prompt_response: "Docs written." }),
    ).toMatchObject({ details: { result: "Docs written." } });
  });

  it("treats a session start as a boundary", () => {
    expect(interpretGeminiHook("SessionStart", "ready", {})).toMatchObject({
      sessionBoundary: true,
    });
  });
});
