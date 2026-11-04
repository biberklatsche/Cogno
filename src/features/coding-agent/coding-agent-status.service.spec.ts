import type { DestroyRef } from "@angular/core";
import type { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import type { TerminalAnimationPort } from "@cogno/core/api/terminal-animation-port";
import type {
  TerminalActivityEvent,
  TerminalMonitorPort,
} from "@cogno/core/api/terminal-monitor-port";
import type { TerminalPlacementPort } from "@cogno/core/api/terminal-placement-port";
import type {
  TerminalProcess,
  TerminalProcessesPort,
} from "@cogno/core/api/terminal-processes-port";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentStatus } from "./agent-status";
import { AGENT_STATUS_REGISTRATION_KEY, AGENT_STATUS_SPECS } from "./coding-agent-animation";
import type { CodingAgentNotificationPreferencesService } from "./coding-agent-notification-preferences.service";
import type { CodingAgentProviderRegistry } from "./coding-agent-provider-registry.service";
import { CodingAgentStatusService, resolveShownStatus } from "./coding-agent-status.service";
import type { AgentSessionEvent, ICodingAgentProvider } from "./ports";
import { interpretClaudeStyleHook } from "./providers/_shared/claude-style-hook.interpreter";

const GRACE_MS = 2000;
const UNBOUND_POLL_MS = 3000;

describe("resolveShownStatus", () => {
  it("shows every status but ready at once", () => {
    expect(resolveShownStatus("working", false, "ready")).toEqual({
      status: "working",
      settleReady: false,
    });
    expect(resolveShownStatus("question", true, "working")).toEqual({
      status: "question",
      settleReady: false,
    });
  });

  it("holds ready back while subagents run, and lets a first ready through", () => {
    expect(resolveShownStatus("ready", true, "working")).toEqual({
      status: "working",
      settleReady: false,
    });
    expect(resolveShownStatus("ready", false, undefined)).toEqual({
      status: "ready",
      settleReady: false,
    });
    expect(resolveShownStatus("ready", false, "ready")).toEqual({
      status: "ready",
      settleReady: false,
    });
  });

  it("lets a ready after work settle", () => {
    expect(resolveShownStatus("ready", false, "working")).toEqual({
      status: "working",
      settleReady: true,
    });
  });
});

/** The daemon-run agent's process in a Cogno terminal. */
function codexProcess(
  terminalId: string,
  overrides: Partial<TerminalProcess> = {},
): TerminalProcess {
  return {
    terminalId,
    processId: 1,
    name: "codex.exe",
    cwd: "/repo",
    startedAt: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

describe("CodingAgentStatusService", () => {
  let claudeEvents: Subject<AgentSessionEvent>;
  let codexEvents: Subject<AgentSessionEvent>;
  let activity: Subject<TerminalActivityEvent>;
  let terminated: Subject<string>;
  let processes: TerminalProcess[];
  let snapshot: ReturnType<typeof vi.fn>;
  let animation: { register: ReturnType<typeof vi.fn>; unregister: ReturnType<typeof vi.fn> };
  let notificationCenter: { dispatch: ReturnType<typeof vi.fn> };
  let destroyCallbacks: Array<() => void>;
  let service: CodingAgentStatusService;

  /** A Claude Code hook that ran in terminal t-1, as its adapter reads it. */
  function ping(status: AgentStatus, hookEvent: string, payload?: unknown, sentAt = 0): void {
    claudeEvents.next({
      sessionId: "s-1",
      terminalId: "t-1",
      cwd: "/repo",
      sentAt,
      event: interpretClaudeStyleHook(hookEvent, status, payload),
    });
  }

  /** A Codex hook from the background service: no terminal, only the session. */
  function codexPing(
    status: AgentStatus,
    hookEvent: string,
    payload?: unknown,
    sessionId = "c-1",
  ): void {
    codexEvents.next({
      sessionId,
      cwd: "/repo",
      sentAt: 0,
      event: interpretClaudeStyleHook(hookEvent, status, payload),
    });
  }

  /** Lets the pending process snapshot resolve and the binding apply. */
  async function settle(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
  }

  function agent() {
    return service.activeAgents()[0];
  }

  beforeEach(() => {
    vi.useFakeTimers();
    claudeEvents = new Subject<AgentSessionEvent>();
    codexEvents = new Subject<AgentSessionEvent>();
    activity = new Subject<TerminalActivityEvent>();
    terminated = new Subject<string>();
    processes = [];
    snapshot = vi.fn(async () => processes);
    animation = { register: vi.fn(), unregister: vi.fn() };
    notificationCenter = { dispatch: vi.fn() };
    destroyCallbacks = [];
    const destroyRef = {
      onDestroy: (callback: () => void) => {
        destroyCallbacks.push(callback);
        return () => {};
      },
    } as unknown as DestroyRef;
    const providers: Partial<ICodingAgentProvider>[] = [
      { id: "claude-code", name: "Claude Code", processNames: ["claude"], events$: claudeEvents },
      { id: "codex", name: "Codex", processNames: ["codex", "codex.exe"], events$: codexEvents },
    ];

    service = new CodingAgentStatusService(
      animation as unknown as TerminalAnimationPort,
      { providers } as unknown as CodingAgentProviderRegistry,
      {
        isTerminalActive: (id: string) => id.startsWith("t-"),
        getCwd: () => "/repo",
        activity$: activity,
        terminated$: terminated,
        cwdChanges$: new Subject(),
      } as unknown as TerminalMonitorPort,
      {
        getPlacement: () => undefined,
        changes$: new Subject(),
      } as unknown as TerminalPlacementPort,
      { snapshot } as unknown as TerminalProcessesPort,
      destroyRef,
      notificationCenter as unknown as NotificationCenterPort,
      {
        shouldNotify: () => true,
        getActiveChannels: () => [],
      } as unknown as CodingAgentNotificationPreferencesService,
    );
    service.start();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("switching the feature off and on", () => {
    it("takes the cards and tab icons away and ignores the agents while off", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });

      service.stop();
      expect(service.activeAgents()).toEqual([]);
      expect(animation.unregister).toHaveBeenCalledWith("t-1", AGENT_STATUS_REGISTRATION_KEY);

      ping("working", "UserPromptSubmit", { prompt: "Write another" });
      expect(service.activeAgents()).toEqual([]);
    });

    it("follows the agents again once switched back on", () => {
      service.stop();
      service.start();

      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      expect(agent()?.status).toBe("working");
    });
  });

  describe("ready and the grace period", () => {
    it("shows ready only after the grace period, then notifies", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      ping("ready", "Stop", { last_assistant_message: "Poem done." });

      expect(agent()?.status).toBe("working");
      expect(notificationCenter.dispatch).not.toHaveBeenCalled();

      vi.advanceTimersByTime(GRACE_MS);
      expect(agent()?.status).toBe("ready");
      expect(agent()?.result).toBe("Poem done.");
      expect(notificationCenter.dispatch).toHaveBeenCalledTimes(1);
      expect(notificationCenter.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ header: "Agent is ready" }),
      );
    });

    it("does not flicker when the agent stops and restarts within the grace period", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      ping("ready", "Stop", { last_assistant_message: "Half done." });
      vi.advanceTimersByTime(GRACE_MS / 2);
      ping("working", "PreToolUse", { tool_name: "Read", tool_input: { file_path: "a.md" } });
      vi.advanceTimersByTime(GRACE_MS);

      expect(agent()?.status).toBe("working");
      expect(agent()?.result).toBeUndefined();
      expect(notificationCenter.dispatch).not.toHaveBeenCalled();
    });

    it("shows a fresh session as ready at once", () => {
      ping("ready", "SessionStart", { source: "startup" });
      expect(agent()?.status).toBe("ready");
    });

    it("defers a ready whose grace period a subagent start interrupts", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      ping("ready", "Stop", { last_assistant_message: "Delegated." });
      ping("working", "SubagentStart", { agent_id: "a" });
      vi.advanceTimersByTime(GRACE_MS);

      expect(agent()?.status).toBe("working");
      expect(agent()?.subagentCount).toBe(1);
      expect(notificationCenter.dispatch).not.toHaveBeenCalled();
    });
  });

  describe("subagents", () => {
    it("shows the working icon on the tab when a subagent start is the first sign of the agent", () => {
      ping("working", "SubagentStart", { agent_id: "a" });

      expect(agent()?.status).toBe("working");
      expect(animation.register).toHaveBeenCalledWith(
        "t-1",
        AGENT_STATUS_REGISTRATION_KEY,
        AGENT_STATUS_SPECS.working,
      );
    });

    it("stays working while subagents run and after the last one stops, until the agent itself stops", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      ping("working", "SubagentStart", { agent_id: "a" });
      ping("working", "SubagentStart", { agent_id: "b" });
      ping("ready", "Stop", { last_assistant_message: "Waiting for the subagents." });
      vi.advanceTimersByTime(GRACE_MS);

      expect(agent()?.status).toBe("working");
      expect(agent()?.subagentCount).toBe(2);

      ping("ready", "SubagentStop", { agent_id: "a" });
      ping("ready", "SubagentStop", { agent_id: "b" });
      vi.advanceTimersByTime(GRACE_MS * 10);
      expect(agent()?.status).toBe("working");
      expect(agent()?.subagentCount).toBe(0);
      expect(notificationCenter.dispatch).not.toHaveBeenCalled();

      // The harness wakes the agent with the results; it works on and stops for real.
      ping("working", "UserPromptSubmit", { prompt: "<task-notification>\n<task-id>a</task-id>" });
      expect(agent()?.task).toBe("Write a poem");
      ping("ready", "Stop", { last_assistant_message: "Poem done." });
      vi.advanceTimersByTime(GRACE_MS);

      expect(agent()?.status).toBe("ready");
      expect(agent()?.result).toBe("Poem done.");
      expect(notificationCenter.dispatch).toHaveBeenCalledTimes(1);
    });

    it("shows a subagent's tool hooks as activity while the main agent waits", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      ping("working", "SubagentStart", { agent_id: "a" });
      ping("ready", "Stop", { last_assistant_message: "Waiting for the subagent." });
      ping("working", "PreToolUse", { tool_name: "Read", tool_input: { file_path: "a.md" } });

      expect(agent()?.status).toBe("working");
      expect(agent()?.activity).toBe("Read: a.md");
    });

    it("counts by id, so duplicate or unknown events do not drift the count", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      ping("working", "SubagentStart", { agent_id: "a" });
      ping("working", "SubagentStart", { agent_id: "a" });
      ping("working", "SubagentStart", { agent_id: "b" });
      expect(agent()?.subagentCount).toBe(2);

      ping("ready", "SubagentStop", { agent_id: "never-started" });
      expect(agent()?.subagentCount).toBe(2);

      ping("ready", "SubagentStop", { agent_id: "a" });
      expect(agent()?.subagentCount).toBe(1);
    });

    it("pairs stops without ids with anonymous starts", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      ping("working", "SubagentStart");
      ping("working", "SubagentStart");
      ping("ready", "SubagentStop");
      expect(agent()?.subagentCount).toBe(1);
      ping("ready", "SubagentStop");
      expect(agent()?.subagentCount).toBe(0);
    });

    it("does not drop a subagent start that arrives after a newer status event", () => {
      ping("working", "PreToolUse", { tool_name: "Bash", tool_input: { command: "ls" } }, 200);
      ping("working", "SubagentStart", { agent_id: "late" }, 100);
      expect(agent()?.subagentCount).toBe(1);
    });

    it("creates the agent from a subagent start, but not from a stray stop", () => {
      ping("ready", "SubagentStop", { agent_id: "a" });
      expect(service.activeAgents()).toHaveLength(0);

      ping("working", "SubagentStart", { agent_id: "a" });
      expect(agent()?.status).toBe("working");
      expect(agent()?.subagentCount).toBe(1);
    });

    it("keeps the count across a SessionStart caused by compaction", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      ping("working", "SubagentStart", { agent_id: "a" });
      ping("ready", "SessionStart", { source: "compact" });
      expect(agent()?.subagentCount).toBe(1);

      ping("ready", "SessionStart", { source: "startup" });
      expect(agent()?.subagentCount).toBe(0);
    });

    it("a new prompt forgets a deferred ready and the subagents counted so far", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      ping("working", "SubagentStart", { agent_id: "a" });
      ping("ready", "Stop", { last_assistant_message: "Poem done." });
      ping("working", "UserPromptSubmit", { prompt: "Now a haiku" });

      expect(agent()?.task).toBe("Now a haiku");
      expect(agent()?.result).toBeUndefined();
      expect(agent()?.subagentCount).toBe(0);

      ping("ready", "SubagentStop", { agent_id: "a" });
      vi.advanceTimersByTime(GRACE_MS);
      expect(agent()?.status).toBe("working");
    });

    it("does not stay working when a subagent's stop never arrives", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      ping("working", "SubagentStart", { agent_id: "lost" });
      // Interrupted: no SubagentStop, no Stop. The user asks again.
      ping("working", "UserPromptSubmit", { prompt: "Try again" });
      ping("ready", "Stop", { last_assistant_message: "Done." });
      vi.advanceTimersByTime(GRACE_MS);

      expect(agent()?.status).toBe("ready");
    });
  });

  describe("status events", () => {
    it("drops a status event older than the newest one applied", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" }, 200);
      ping("question", "PermissionRequest", { tool_name: "Bash" }, 100);
      expect(agent()?.status).toBe("working");
    });

    it("notifies on a question and on an error", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      ping("question", "PermissionRequest", {
        tool_name: "Bash",
        tool_input: { command: "rm -rf dist" },
      });
      ping("error", "PostToolUseFailure", { tool_name: "Bash", error: "exit 1" });

      expect(notificationCenter.dispatch).toHaveBeenCalledTimes(2);
      expect(notificationCenter.dispatch).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ header: "Agent has a question", type: "warning" }),
      );
      expect(notificationCenter.dispatch).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ header: "Agent reported an error", type: "error" }),
      );
      expect(agent()?.activity).toBe("exit 1");
    });

    it("reports attention for the side-menu badge, error before question", () => {
      expect(service.attention()).toBeUndefined();
      ping("question", "PermissionRequest", {});
      expect(service.attention()).toBe("question");
      ping("error", "PostToolUseFailure", {});
      expect(service.attention()).toBe("error");
    });

    it("keys the cards by session: two sessions are two cards", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      claudeEvents.next({
        sessionId: "s-2",
        terminalId: "t-2",
        sentAt: 0,
        event: interpretClaudeStyleHook("UserPromptSubmit", "working", { prompt: "Other" }),
      });
      expect(service.activeAgents().map((a) => a.sessionId)).toEqual(["s-1", "s-2"]);
    });

    it("replaces the session a terminal ran before when a new one binds to it", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      claudeEvents.next({
        sessionId: "s-2",
        terminalId: "t-1",
        sentAt: 0,
        event: interpretClaudeStyleHook("SessionStart", "ready", { source: "startup" }),
      });
      expect(service.activeAgents().map((a) => a.sessionId)).toEqual(["s-2"]);
    });
  });

  describe("model", () => {
    it("keeps the model across tasks and follows a model switch", () => {
      ping("ready", "SessionStart", { source: "startup", model: "claude-opus-5" });
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      expect(agent()?.model).toBe("claude-opus-5");

      ping("ready", "PostModelSwitch", { to_model: "claude-sonnet-5" });
      expect(agent()?.model).toBe("claude-sonnet-5");
      expect(agent()?.status).toBe("working");
    });

    it("does not create an agent from a model switch alone", () => {
      ping("ready", "PostModelSwitch", { to_model: "claude-sonnet-5" });
      expect(service.activeAgents()).toHaveLength(0);
    });
  });

  describe("sessions without a terminal", () => {
    it("binds the session to the one terminal that runs the agent in its folder", async () => {
      processes = [codexProcess("t-1"), codexProcess("t-2", { cwd: "/other" })];
      codexPing("working", "UserPromptSubmit", { prompt: "Fix the build" });

      // Held back until the terminals' processes were looked at.
      expect(service.activeAgents()).toHaveLength(0);
      await settle();

      expect(agent()?.terminalId).toBe("t-1");
      expect(agent()?.task).toBe("Fix the build");
      expect(animation.register).toHaveBeenCalledWith(
        "t-1",
        AGENT_STATUS_REGISTRATION_KEY,
        AGENT_STATUS_SPECS.working,
      );
    });

    it("shows the session without a terminal while several terminals come into question", async () => {
      const old = Math.floor(Date.now() / 1000) - 3600;
      processes = [
        codexProcess("t-1", { startedAt: old }),
        codexProcess("t-2", { startedAt: old }),
      ];
      codexPing("working", "UserPromptSubmit", { prompt: "Fix the build" });
      await settle();

      expect(agent()?.terminalId).toBeUndefined();
      expect(agent()?.cwd).toBe("/repo");
      expect(animation.register).not.toHaveBeenCalled();

      // One terminal's agent is gone: the other one is it.
      processes = [codexProcess("t-2", { startedAt: old })];
      await vi.advanceTimersByTimeAsync(UNBOUND_POLL_MS);
      expect(agent()?.terminalId).toBe("t-2");
    });

    it("ignores a session no Cogno terminal runs, and looks again later", async () => {
      processes = [];
      codexPing("working", "UserPromptSubmit", { prompt: "From VS Code" });
      await settle();
      expect(service.activeAgents()).toHaveLength(0);

      codexPing("working", "PreToolUse", { tool_name: "Bash", tool_input: { command: "ls" } });
      expect(snapshot).toHaveBeenCalledTimes(1);

      processes = [codexProcess("t-1")];
      vi.advanceTimersByTime(60_000);
      codexPing("working", "PreToolUse", { tool_name: "Bash", tool_input: { command: "ls" } });
      await settle();
      expect(agent()?.terminalId).toBe("t-1");
    });

    it("forgets a session without a terminal once its agent runs nowhere", async () => {
      const old = Math.floor(Date.now() / 1000) - 3600;
      processes = [
        codexProcess("t-1", { startedAt: old }),
        codexProcess("t-2", { startedAt: old }),
      ];
      codexPing("working", "UserPromptSubmit", { prompt: "Fix the build" });
      await settle();
      expect(service.activeAgents()).toHaveLength(1);

      processes = [];
      await vi.advanceTimersByTimeAsync(UNBOUND_POLL_MS);
      expect(service.activeAgents()).toHaveLength(0);
    });

    it("does not notify for a session before it is shown", async () => {
      processes = [codexProcess("t-1")];
      codexPing("working", "UserPromptSubmit", { prompt: "Fix the build" });
      codexPing("question", "PermissionRequest", { tool_name: "Bash" });
      await settle();

      expect(agent()?.status).toBe("question");
      expect(notificationCenter.dispatch).not.toHaveBeenCalled();
    });

    it("treats a terminal this window does not have as none", async () => {
      processes = [codexProcess("t-1")];
      codexEvents.next({
        sessionId: "c-1",
        terminalId: "stale-from-daemon",
        cwd: "/repo",
        sentAt: 0,
        event: interpretClaudeStyleHook("UserPromptSubmit", "working", { prompt: "Go" }),
      });
      await settle();
      expect(agent()?.terminalId).toBe("t-1");
    });
  });

  describe("lifetime", () => {
    it("forgets the agent and its pending ready when the terminal goes idle or ends", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      ping("ready", "Stop", { last_assistant_message: "Poem done." });
      activity.next({ terminalId: "t-1", isBusy: false });

      expect(service.activeAgents()).toHaveLength(0);
      expect(animation.unregister).toHaveBeenCalledWith("t-1", AGENT_STATUS_REGISTRATION_KEY);
      vi.advanceTimersByTime(GRACE_MS);
      expect(notificationCenter.dispatch).not.toHaveBeenCalled();

      ping("working", "UserPromptSubmit", { prompt: "Again" });
      terminated.next("t-1");
      expect(service.activeAgents()).toHaveLength(0);
    });

    it("clears pending timers when the service is destroyed", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      ping("ready", "Stop", { last_assistant_message: "Poem done." });
      for (const callback of destroyCallbacks) callback();
      vi.advanceTimersByTime(GRACE_MS);

      expect(notificationCenter.dispatch).not.toHaveBeenCalled();
    });
  });
});
