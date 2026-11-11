import type { AgentHookEvent } from "@cogno/features/coding-agent/ports";
import { describe, expect, it } from "vitest";
import { interpretOpenCodeEvent, openCodeSession } from "./opencode-event.interpreter";

const MAIN = { session_id: "ses_main", directory: "C:\\work\\app" };
const CHILD = { session_id: "ses_child", parent_id: "ses_main", directory: "C:\\work\\app" };

const detailsOf = (event: AgentHookEvent | undefined) =>
  event?.kind === "status" ? event.details : undefined;

describe("openCodeSession", () => {
  it("keys a session by its id and folder, and a subagent's by its parent", () => {
    expect(openCodeSession(MAIN)).toEqual({ sessionId: "ses_main", cwd: "C:\\work\\app" });
    expect(openCodeSession(CHILD)).toEqual({ sessionId: "ses_main", cwd: "C:\\work\\app" });
    expect(openCodeSession("omitted:not-json")).toEqual({ sessionId: undefined, cwd: undefined });
  });
});

describe("interpretOpenCodeEvent", () => {
  it("starts a session on session.created, with the model", () => {
    expect(
      interpretOpenCodeEvent("session.created", "ready", {
        ...MAIN,
        model: { providerID: "anthropic", modelID: "claude-sonnet-5-5" },
      }),
    ).toEqual({
      kind: "status",
      status: "ready",
      sessionBoundary: true,
      details: { model: "claude-sonnet-5-5" },
    });
  });

  it("reads the task from the prompt, the activity from a tool call, a permission or a failure", () => {
    expect(
      detailsOf(
        interpretOpenCodeEvent("session.prompt", "working", {
          ...MAIN,
          prompt: "Fix the build\nplease",
        }),
      ),
    ).toEqual({ task: "Fix the build" });
    expect(
      detailsOf(
        interpretOpenCodeEvent("tool.execute.before", "working", {
          ...MAIN,
          tool_name: "bash",
          tool_input: { command: "pnpm test", file_path: "x" },
        }),
      ),
    ).toEqual({ activity: "bash: pnpm test" });
    expect(
      detailsOf(
        interpretOpenCodeEvent("permission.asked", "question", { ...MAIN, action: "bash" }),
      ),
    ).toEqual({ activity: "Permission: bash" });
    expect(
      detailsOf(
        interpretOpenCodeEvent("session.execution.failed", "error", {
          ...MAIN,
          error: { name: "APIError", message: "rate limited" },
        }),
      ),
    ).toEqual({ activity: "rate limited" });
    expect(interpretOpenCodeEvent("session.execution.succeeded", "ready", MAIN)).toEqual({
      kind: "status",
      status: "ready",
      sessionBoundary: false,
      details: {},
    });
  });

  it("turns a child session into a subagent of its parent and ignores its inner events", () => {
    expect(interpretOpenCodeEvent("session.created", "ready", CHILD)).toEqual({
      kind: "subagent",
      change: "start",
      agentId: "ses_child",
    });
    expect(interpretOpenCodeEvent("session.execution.started", "working", CHILD)).toBeUndefined();
    expect(interpretOpenCodeEvent("tool.execute.before", "working", CHILD)).toBeUndefined();
    expect(interpretOpenCodeEvent("session.execution.interrupted", "ready", CHILD)).toEqual({
      kind: "subagent",
      change: "stop",
      agentId: "ses_child",
    });
  });
});
