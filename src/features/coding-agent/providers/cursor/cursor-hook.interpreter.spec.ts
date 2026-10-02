import { describe, expect, it } from "vitest";
import { interpretCursorHook } from "./cursor-hook.interpreter";

describe("interpretCursorHook", () => {
  it("reads the prompt, a tool call and a failure by Cursor's field names", () => {
    expect(interpretCursorHook("beforeSubmitPrompt", "working", { prompt: "Write docs" })).toEqual({
      kind: "status",
      status: "working",
      sessionBoundary: false,
      details: { task: "Write docs" },
    });
    expect(
      interpretCursorHook("postToolUse", "working", {
        tool_name: "Shell",
        tool_input: { command: "ls" },
      }),
    ).toMatchObject({ details: { activity: "Shell: ls" } });
    expect(
      interpretCursorHook("postToolUseFailure", "error", {
        tool_name: "Shell",
        error_message: "command not found",
      }),
    ).toMatchObject({ status: "error", details: { activity: "command not found" } });
  });

  it("treats a session start and end as boundaries", () => {
    expect(interpretCursorHook("sessionStart", "ready", {})).toMatchObject({
      sessionBoundary: true,
    });
    expect(interpretCursorHook("sessionEnd", "ready", {})).toMatchObject({
      sessionBoundary: true,
    });
    expect(interpretCursorHook("stop", "ready", {})).toMatchObject({ sessionBoundary: false });
  });

  it("reads the model and compaction", () => {
    expect(interpretCursorHook("stop", "ready", { model: "gpt-5" })).toMatchObject({
      details: { model: "gpt-5" },
    });
    expect(interpretCursorHook("preCompact", "working", { trigger: "auto" })).toMatchObject({
      details: { activity: "Compacting context (auto)…" },
    });
  });
});
