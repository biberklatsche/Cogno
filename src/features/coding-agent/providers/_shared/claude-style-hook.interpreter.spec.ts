import { describe, expect, it } from "vitest";
import { AgentStatus } from "../../agent-status";
import { interpretClaudeStyleHook } from "./claude-style-hook.interpreter";
import { editedFilesByTool } from "./hook-payload";

const interpret = (hookEvent: string, status: AgentStatus, payload: unknown) =>
  interpretClaudeStyleHook(hookEvent, status, payload, editedFilesByTool({ Edit: "file_path" }));

describe("interpretClaudeStyleHook", () => {
  it("takes a submitted prompt as the task, first line only", () => {
    expect(
      interpret("UserPromptSubmit", "working", {
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
    const notification = interpret("UserPromptSubmit", "working", {
      prompt: "<task-notification>\n<task-id>abc</task-id>",
    });
    const agentMessage = interpret("UserPromptSubmit", "working", {
      prompt: '<agent-message from="a12e" name="fork">\nDone',
    });
    expect(notification).toMatchObject({ kind: "status", details: {} });
    expect(agentMessage).toMatchObject({ kind: "status", details: {} });
  });

  it("keeps a user prompt that merely starts with a tag", () => {
    expect(
      interpret("UserPromptSubmit", "working", { prompt: "<div> is not centered" }),
    ).toMatchObject({ details: { task: "<div> is not centered" } });
  });

  it("prefers a tool's description over its raw command, then command, then file path", () => {
    const withDescription = interpret("PreToolUse", "working", {
      tool_name: "Bash",
      tool_input: { command: "pnpm i", description: "Install deps" },
    });
    const withCommand = interpret("PreToolUse", "working", {
      tool_name: "Bash",
      tool_input: { command: "ls" },
    });
    const withPath = interpret("PreToolUse", "working", {
      tool_name: "Edit",
      tool_input: { file_path: "/a/b.ts" },
    });
    expect(withDescription).toMatchObject({ details: { activity: "Bash: Install deps" } });
    expect(withCommand).toMatchObject({ details: { activity: "Bash: ls" } });
    expect(withPath).toMatchObject({ details: { activity: "Edit: /a/b.ts" } });
  });

  it("uses a notification message or an error as the activity", () => {
    expect(
      interpret("Notification", "question", { message: "Claude needs permission" }),
    ).toMatchObject({ details: { activity: "Claude needs permission" } });
    expect(
      interpret("PostToolUseFailure", "error", {
        tool_name: "Bash",
        error: "exit 1",
      }),
    ).toMatchObject({ details: { activity: "exit 1" } });
  });

  it("reports the closing message as the result", () => {
    expect(interpret("Stop", "ready", { last_assistant_message: "Done.\nMore" })).toMatchObject({
      details: { result: "Done." },
    });
  });

  it("truncates long lines", () => {
    const event = interpret("UserPromptSubmit", "working", {
      prompt: "x".repeat(200),
    });
    const task = event.kind === "status" ? event.details.task : undefined;
    expect(task).toHaveLength(120);
    expect(task?.endsWith("…")).toBe(true);
  });

  it("reads subagent starts and stops with their id", () => {
    expect(interpret("SubagentStart", "working", { agent_id: "a" })).toEqual({
      kind: "subagent",
      change: "start",
      agentId: "a",
    });
    expect(interpret("SubagentStop", "ready", {})).toEqual({
      kind: "subagent",
      change: "stop",
      agentId: undefined,
    });
  });

  it("marks session start and end as boundaries, except a restart after compaction", () => {
    expect(interpret("SessionStart", "ready", { source: "startup" })).toMatchObject({
      sessionBoundary: true,
    });
    expect(interpret("SessionStart", "ready", { source: "compact" })).toMatchObject({
      sessionBoundary: false,
    });
    expect(interpret("SessionEnd", "ready", {})).toMatchObject({
      sessionBoundary: true,
    });
    expect(interpret("Stop", "ready", {})).toMatchObject({
      sessionBoundary: false,
    });
  });

  it("returns no details for omitted or non-object payloads", () => {
    expect(interpret("Stop", "ready", "omitted:not-json")).toMatchObject({
      details: {},
    });
    expect(interpret("Stop", "ready", undefined)).toMatchObject({ details: {} });
  });

  it("reads the model, but not one reported from inside a subagent", () => {
    expect(
      interpret("SessionStart", "ready", { source: "startup", model: "claude-opus-5" }),
    ).toMatchObject({
      details: { model: "claude-opus-5" },
    });
    expect(interpret("PreToolUse", "working", { model: "gpt-5.5", agent_id: "a" })).toMatchObject({
      details: {},
    });
  });

  it("reads a model switch without a status", () => {
    expect(interpret("PostModelSwitch", "ready", { to_model: "claude-sonnet-5" })).toEqual({
      kind: "model",
      model: "claude-sonnet-5",
    });
  });

  it("reports a file as edited only once its tool call finished", () => {
    const payload = { tool_name: "Edit", tool_input: { file_path: "/a/b.ts" } };
    expect(interpret("PostToolUse", "working", payload)).toMatchObject({
      details: { editedFiles: ["/a/b.ts"] },
    });
    const pending = interpret("PreToolUse", "working", payload);
    expect(pending.kind === "status" && pending.details.editedFiles).toBeFalsy();
  });

  it("describes compaction as the activity", () => {
    expect(interpret("PreCompact", "working", { trigger: "auto" })).toMatchObject({
      details: { activity: "Compacting context (auto)…" },
    });
    expect(interpret("PreCompact", "working", { trigger: "manual" })).toMatchObject({
      details: { activity: "Compacting context…" },
    });
    expect(interpret("PostCompact", "working", { trigger: "auto" })).toMatchObject({
      details: { activity: "Context compacted" },
    });
  });
});
