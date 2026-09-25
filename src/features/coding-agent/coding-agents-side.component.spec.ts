import type { DestroyRef } from "@angular/core";
import { signal } from "@angular/core";
import type { SessionApi } from "@cogno/core/api/session-api";
import type { TerminalNavigator } from "@cogno/core/api/terminal-navigator-port";
import type { ContextMenuOverlayService } from "@cogno/shared/ui";
import { of } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CodingAgentNotificationPreferencesService } from "./coding-agent-notification-preferences.service";
import type { CodingAgentStartupService } from "./coding-agent-startup.service";
import type { ActiveAgent, CodingAgentStatusService } from "./coding-agent-status.service";
import { CodingAgentsSideComponent, cardState, countOf } from "./coding-agents-side.component";

function agent(overrides: Partial<ActiveAgent> = {}): ActiveAgent {
  return {
    terminalId: "t-1",
    providerId: "claude-code",
    providerName: "Claude Code",
    status: "working",
    statusSince: Date.now(),
    subagentCount: 0,
    ...overrides,
  };
}

describe("cardState", () => {
  it("splits ready into done and idle", () => {
    expect(cardState(agent({ status: "ready", task: "Fix it" }))).toBe("done");
    expect(cardState(agent({ status: "ready" }))).toBe("idle");
    expect(cardState(agent({ status: "question" }))).toBe("question");
  });
});

describe("countOf", () => {
  it("picks the singular for one and the plural otherwise", () => {
    expect(countOf(1, "subagent")).toBe("1 subagent");
    expect(countOf(2, "subagent")).toBe("2 subagents");
    expect(countOf(1, "needs you", "need you")).toBe("1 needs you");
    expect(countOf(3, "needs you", "need you")).toBe("3 need you");
  });
});

describe("CodingAgentsSideComponent", () => {
  let activeAgents: ReturnType<typeof signal<ReadonlyArray<ActiveAgent>>>;
  let navigateToTerminal: ReturnType<typeof vi.fn>;
  let component: CodingAgentsSideComponent;

  beforeEach(() => {
    vi.useFakeTimers();
    activeAgents = signal<ReadonlyArray<ActiveAgent>>([]);
    navigateToTerminal = vi.fn().mockResolvedValue(undefined);

    component = new CodingAgentsSideComponent(
      {
        installedProviders: signal([]),
        isScanning: signal(false),
      } as unknown as CodingAgentStartupService,
      { activeAgents } as unknown as CodingAgentStatusService,
      { state: signal({}) } as unknown as CodingAgentNotificationPreferencesService,
      { navigateToTerminal } as unknown as TerminalNavigator,
      {} as ContextMenuOverlayService,
      { boundSession$: of({ status: "unbound" }) } as unknown as SessionApi,
      { onDestroy: () => () => {} } as unknown as DestroyRef,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("labels the state, with ready split into done and idle", () => {
    expect(component.statusLabel(agent({ status: "working" }))).toBe("Working");
    expect(component.statusLabel(agent({ status: "question" }))).toBe("Needs you");
    expect(component.statusLabel(agent({ status: "error" }))).toBe("Error");
    expect(component.statusLabel(agent({ status: "ready", task: "Fix it" }))).toBe("Done");
    expect(component.statusLabel(agent({ status: "ready" }))).toBe("Idle");
  });

  it("shows the result once done and the activity otherwise", () => {
    const busy = agent({ status: "working", activity: "Bash: ls", result: "stale" });
    const done = agent({ status: "ready", activity: "Bash: ls", result: "All green." });
    expect(component.detail(busy)).toBe("Bash: ls");
    expect(component.detail(done)).toBe("All green.");
  });

  it("formats the time spent working", () => {
    const now = Date.now();
    expect(component.elapsed(agent({ statusSince: now - 42_000 }))).toBe("42s");
    expect(component.elapsed(agent({ statusSince: now - 185_000 }))).toBe("3m 05s");
    expect(component.elapsed(agent({ statusSince: now - 4_320_000 }))).toBe("1h 12m");
  });

  it("keeps the clock ticking only while an agent works", () => {
    const start = Date.now();
    activeAgents.set([agent({ status: "ready", statusSince: start })]);
    vi.advanceTimersByTime(5_000);
    expect(component.elapsed(agent({ statusSince: start }))).toBe("0s");

    activeAgents.set([agent({ status: "working", statusSince: start })]);
    vi.advanceTimersByTime(5_000);
    expect(component.elapsed(agent({ statusSince: start }))).toBe("10s");
  });

  it("counts the agents per state for the summary chips", () => {
    activeAgents.set([
      agent({ terminalId: "a", status: "working" }),
      agent({ terminalId: "b", status: "working" }),
      agent({ terminalId: "c", status: "question" }),
      agent({ terminalId: "d", status: "ready", task: "Fix it" }),
      agent({ terminalId: "e", status: "ready" }),
    ]);
    expect(component.summary()).toEqual({ working: 2, question: 1, error: 0, done: 1, idle: 1 });
  });

  it("navigates to the agent's terminal on click", () => {
    component.navigateTo(agent({ terminalId: "t-9" }));
    expect(navigateToTerminal).toHaveBeenCalledWith("t-9");
  });
});
