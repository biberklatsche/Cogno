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

  it("reads the model, finished file edits and compaction", () => {
    expect(
      interpretGeminiHook("BeforeModel", "working", { llm_request: { model: "gemini-3-pro" } }),
    ).toMatchObject({ details: { model: "gemini-3-pro" } });
    expect(
      interpretGeminiHook("AfterTool", "working", {
        tool_name: "replace",
        tool_input: { file_path: "/a/b.ts" },
        tool_response: {},
      }),
    ).toMatchObject({ details: { editedFiles: ["/a/b.ts"] } });
    const failed = interpretGeminiHook("AfterTool", "working", {
      tool_name: "replace",
      tool_input: { file_path: "/a/b.ts" },
      tool_response: { error: "no match" },
    });
    expect(failed.kind === "status" && failed.details.editedFiles).toBeFalsy();
    expect(interpretGeminiHook("PreCompress", "working", { trigger: "auto" })).toMatchObject({
      details: { activity: "Compacting context (auto)…" },
    });
  });
});
