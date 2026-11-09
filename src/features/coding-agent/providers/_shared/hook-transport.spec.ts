import type { TerminalIpcPort } from "@cogno/core/api/terminal-ipc-port";
import type { TerminalIpcMessage } from "@cogno/shared/domain";
import { Subject } from "rxjs";
import { describe, expect, it } from "vitest";
import type { AgentSessionEvent } from "../../ports";
import { CODING_AGENT_HOOK_COMMAND } from "./hook-command";
import { HookMessage, HookReading, hookSessionEvents$, toSessionEvent } from "./hook-transport";

const reading: HookReading = {
  hookEvents: [
    { eventName: "Stop", status: "ready" },
    { eventName: "UserPromptSubmit", status: "working" },
  ],
  interpret: (_hookEvent, status) => ({
    kind: "status",
    status,
    sessionBoundary: false,
    details: {},
  }),
  sessionOf: (payload) => {
    const fields = payload as Record<string, string> | undefined;
    return { sessionId: fields?.["session_id"], cwd: fields?.["cwd"] };
  },
};

const message = (overrides: Partial<HookMessage> = {}): HookMessage => ({
  hookEvent: "Stop",
  sentAt: 5,
  payload: { session_id: "s1", cwd: "/work" },
  ...overrides,
});

describe("hookSessionEvents$", () => {
  it("takes only this provider's hooks and reads provider, order and event from the args", () => {
    const ipc = { messages$: new Subject<TerminalIpcMessage>() } as unknown as TerminalIpcPort;
    const received: AgentSessionEvent[] = [];
    hookSessionEvents$(ipc, "codex", reading).subscribe((event) => received.push(event));

    (ipc.messages$ as Subject<TerminalIpcMessage>).next({
      command: CODING_AGENT_HOOK_COMMAND,
      args: ["claude-code", "1", "Stop"],
    });
    (ipc.messages$ as Subject<TerminalIpcMessage>).next({
      command: "something_else",
      args: ["codex", "1", "Stop"],
    });
    (ipc.messages$ as Subject<TerminalIpcMessage>).next({
      command: CODING_AGENT_HOOK_COMMAND,
      args: ["codex", "1700000000123", "UserPromptSubmit"],
      terminalId: "t-1",
      payload: { session_id: "s1" },
    });

    (ipc.messages$ as Subject<TerminalIpcMessage>).next({
      command: CODING_AGENT_HOOK_COMMAND,
      args: ["codex", "1", "Unknown"],
      payload: { session_id: "s1" },
    });

    expect(received).toEqual([
      {
        sessionId: "s1",
        terminalId: "t-1",
        sentAt: 1700000000123,
        event: { kind: "status", status: "working", sessionBoundary: false, details: {} },
      },
    ]);
  });
});

describe("toSessionEvent", () => {
  it("keys the event by the agent's session and carries terminal and cwd", () => {
    expect(toSessionEvent(message({ terminalId: "t-1" }), reading)).toEqual({
      sessionId: "s1",
      terminalId: "t-1",
      cwd: "/work",
      sentAt: 5,
      event: { kind: "status", status: "ready", sessionBoundary: false, details: {} },
    });
  });

  it("falls back to the terminal as the session when the payload names none", () => {
    expect(toSessionEvent(message({ terminalId: "t-1", payload: {} }), reading)).toMatchObject({
      sessionId: "terminal:t-1",
    });
  });

  it("drops a hook with neither session nor terminal, and one on an event not hooked", () => {
    expect(toSessionEvent(message({ payload: {} }), reading)).toBeUndefined();
    expect(toSessionEvent(message({ hookEvent: "Unknown" }), reading)).toBeUndefined();
  });
});
