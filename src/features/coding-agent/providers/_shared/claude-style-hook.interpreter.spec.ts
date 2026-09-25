import { describe, expect, it } from "vitest";
import { interpretClaudeStyleHook } from "./claude-style-hook.interpreter";

describe("interpretClaudeStyleHook", () => {
  it("takes a submitted prompt as the task, first line only", () => {
    expect(
      interpretClaudeStyleHook("UserPromptSubmit", "working", {
        prompt: "  Fix the login bug\n\nDetails…",
      }),
    ).toEqual({
      kind: "status",
      status: "working",
      sessionBoundary: false,
      details: { task: "Fix the login bug" },
    });
  });

  it("ignores prompts the harness injects, such as task notifications", () => {
    const notification = interpretClaudeStyleHook("UserPromptSubmit", "working", {
      prompt: "<task-notification>\n<task-id>abc</task-id>",
    });
    const agentMessage = interpretClaudeStyleHook("UserPromptSubmit", "working", {
      prompt: '<agent-message from="a12e" name="fork">\nDone',
    });
    expect(notification).toMatchObject({ kind: "status", details: {} });
    expect(agentMessage).toMatchObject({ kind: "status", details: {} });
  });

  it("keeps a user prompt that merely starts with a tag", () => {
    expect(
      interpretClaudeStyleHook("UserPromptSubmit", "working", { prompt: "<div> is not centered" }),
    ).toMatchObject({ details: { task: "<div> is not centered" } });
  });

  it("prefers a tool's description over its raw command, then command, then file path", () => {
    const withDescription = interpretClaudeStyleHook("PreToolUse", "working", {
      tool_name: "Bash",
      tool_input: { command: "pnpm i", description: "Install deps" },
    });
    const withCommand = interpretClaudeStyleHook("PreToolUse", "working", {
      tool_name: "Bash",
      tool_input: { command: "ls" },
    });
    const withPath = interpretClaudeStyleHook("PreToolUse", "working", {
      tool_name: "Edit",
      tool_input: { file_path: "/a/b.ts" },
    });
    expect(withDescription).toMatchObject({ details: { activity: "Bash: Install deps" } });
    expect(withCommand).toMatchObject({ details: { activity: "Bash: ls" } });
    expect(withPath).toMatchObject({ details: { activity: "Edit: /a/b.ts" } });
  });

  it("uses a notification message or an error as the activity", () => {
    expect(
      interpretClaudeStyleHook("Notification", "question", { message: "Claude needs permission" }),
    ).toMatchObject({ details: { activity: "Claude needs permission" } });
    expect(
      interpretClaudeStyleHook("PostToolUseFailure", "error", {
        tool_name: "Bash",
        error: "exit 1",
      }),
    ).toMatchObject({ details: { activity: "exit 1" } });
  });

  it("reports the closing message as the result", () => {
    expect(
      interpretClaudeStyleHook("Stop", "ready", { last_assistant_message: "Done.\nMore" }),
    ).toMatchObject({ details: { result: "Done." } });
  });

  it("truncates long lines", () => {
    const event = interpretClaudeStyleHook("UserPromptSubmit", "working", {
      prompt: "x".repeat(200),
    });
    const task = event.kind === "status" ? event.details.task : undefined;
    expect(task).toHaveLength(120);
    expect(task?.endsWith("…")).toBe(true);
  });

  it("reads subagent starts and stops with their id", () => {
    expect(interpretClaudeStyleHook("SubagentStart", "working", { agent_id: "a" })).toEqual({
      kind: "subagent",
      change: "start",
      agentId: "a",
    });
    expect(interpretClaudeStyleHook("SubagentStop", "ready", {})).toEqual({
      kind: "subagent",
      change: "stop",
      agentId: undefined,
    });
  });

  it("marks session start and end as boundaries, except a restart after compaction", () => {
    expect(interpretClaudeStyleHook("SessionStart", "ready", { source: "startup" })).toMatchObject({
      sessionBoundary: true,
    });
    expect(interpretClaudeStyleHook("SessionStart", "ready", { source: "compact" })).toMatchObject({
      sessionBoundary: false,
    });
    expect(interpretClaudeStyleHook("SessionEnd", "ready", {})).toMatchObject({
      sessionBoundary: true,
    });
    expect(interpretClaudeStyleHook("Stop", "ready", {})).toMatchObject({
      sessionBoundary: false,
    });
  });

  it("returns no details for omitted or non-object payloads", () => {
    expect(interpretClaudeStyleHook("Stop", "ready", "omitted:not-json")).toMatchObject({
      details: {},
    });
    expect(interpretClaudeStyleHook("Stop", "ready", undefined)).toMatchObject({ details: {} });
  });
});
