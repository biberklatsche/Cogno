import type { DestroyRef } from "@angular/core";
import type { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import type { TerminalAnimationPort } from "@cogno/core/api/terminal-animation-port";
import type { TerminalIpcPort } from "@cogno/core/api/terminal-ipc-port";
import type {
  TerminalActivityEvent,
  TerminalMonitorPort,
} from "@cogno/core/api/terminal-monitor-port";
import type { TerminalPlacementPort } from "@cogno/core/api/terminal-placement-port";
import type { TerminalIpcMessage } from "@cogno/shared/domain";
import type { ApplicationConfigurationPort } from "@cogno/shared/ports";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CodingAgentNotificationPreferencesService } from "./coding-agent-notification-preferences.service";
import type { CodingAgentProviderRegistry } from "./coding-agent-provider-registry.service";
import { CodingAgentStatusService, resolveShownStatus } from "./coding-agent-status.service";
import { interpretClaudeStyleHook } from "./providers/_shared/claude-style-hook.interpreter";
import { CODING_AGENT_STATUS_ACTION } from "./providers/_shared/hook-command.builder";

const GRACE_MS = 2000;

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

describe("CodingAgentStatusService", () => {
  let messages: Subject<TerminalIpcMessage>;
  let activity: Subject<TerminalActivityEvent>;
  let terminated: Subject<string>;
  let animation: { register: ReturnType<typeof vi.fn> };
  let notificationCenter: { dispatch: ReturnType<typeof vi.fn> };
  let destroyCallbacks: Array<() => void>;
  let service: CodingAgentStatusService;

  function ping(status: string, hookEvent: string, payload?: unknown, seq = 0): void {
    messages.next({
      command: CODING_AGENT_STATUS_ACTION,
      args: [status, "claude-code", hookEvent, String(seq)],
      terminalId: "t-1",
      payload,
    });
  }

  function agent() {
    return service.activeAgents()[0];
  }

  beforeEach(() => {
    vi.useFakeTimers();
    messages = new Subject<TerminalIpcMessage>();
    activity = new Subject<TerminalActivityEvent>();
    terminated = new Subject<string>();
    animation = { register: vi.fn() };
    notificationCenter = { dispatch: vi.fn() };
    destroyCallbacks = [];
    const destroyRef = {
      onDestroy: (callback: () => void) => {
        destroyCallbacks.push(callback);
        return () => {};
      },
    } as unknown as DestroyRef;

    service = new CodingAgentStatusService(
      { messages$: messages } as unknown as TerminalIpcPort,
      animation as unknown as TerminalAnimationPort,
      { getConfiguration: () => ({}) } as unknown as ApplicationConfigurationPort,
      {
        providers: [
          { id: "claude-code", name: "Claude Code", interpretHook: interpretClaudeStyleHook },
        ],
      } as unknown as CodingAgentProviderRegistry,
      {
        isTerminalActive: () => true,
        getCwd: () => "/repo",
        activity$: activity,
        terminated$: terminated,
        cwdChanges$: new Subject(),
      } as unknown as TerminalMonitorPort,
      {
        getPlacement: () => undefined,
        changes$: new Subject(),
      } as unknown as TerminalPlacementPort,
      destroyRef,
      notificationCenter as unknown as NotificationCenterPort,
      {
        shouldNotify: () => true,
        getActiveChannels: () => [],
      } as unknown as CodingAgentNotificationPreferencesService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
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

    it("does not drop a subagent start that arrives after a newer status ping", () => {
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

    it("a new prompt forgets a deferred ready", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      ping("working", "SubagentStart", { agent_id: "a" });
      ping("ready", "Stop", { last_assistant_message: "Poem done." });
      ping("working", "UserPromptSubmit", { prompt: "Now a haiku" });

      expect(agent()?.task).toBe("Now a haiku");
      expect(agent()?.result).toBeUndefined();

      ping("ready", "SubagentStop", { agent_id: "a" });
      vi.advanceTimersByTime(GRACE_MS);
      expect(agent()?.status).toBe("working");
    });
  });

  describe("status pings", () => {
    it("drops a status ping older than the newest one applied", () => {
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

    it("takes an unregistered provider's status without reading its payload", () => {
      messages.next({
        command: CODING_AGENT_STATUS_ACTION,
        args: ["working", "unknown-agent", "Whatever", "0"],
        terminalId: "t-1",
        payload: { prompt: "should not be read" },
      });
      expect(agent()?.status).toBe("working");
      expect(agent()?.providerName).toBe("unknown-agent");
      expect(agent()?.task).toBeUndefined();
    });
  });

  describe("lifetime", () => {
    it("forgets the agent and its pending ready when the terminal goes idle or ends", () => {
      ping("working", "UserPromptSubmit", { prompt: "Write a poem" });
      ping("ready", "Stop", { last_assistant_message: "Poem done." });
      activity.next({ terminalId: "t-1", isBusy: false });

      expect(service.activeAgents()).toHaveLength(0);
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

      expect(agent()?.status).toBe("working");
      expect(notificationCenter.dispatch).not.toHaveBeenCalled();
    });
  });
});
