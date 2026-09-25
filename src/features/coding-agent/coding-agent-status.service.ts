import { computed, DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import { TerminalAnimationPort } from "@cogno/core/api/terminal-animation-port";
import { TerminalIpcPort } from "@cogno/core/api/terminal-ipc-port";
import { TerminalMonitorPort } from "@cogno/core/api/terminal-monitor-port";
import { TerminalPlacement, TerminalPlacementPort } from "@cogno/core/api/terminal-placement-port";
import { AgentStatus, NotificationTypeContract, TerminalIpcMessage } from "@cogno/shared/domain";
import { ApplicationConfigurationPort } from "@cogno/shared/ports";
import { filter, map, merge } from "rxjs";
import { AGENT_STATUS_REGISTRATION_KEY, AGENT_STATUS_SPECS } from "./coding-agent-animation";
import { CodingAgentNotificationPreferencesService } from "./coding-agent-notification-preferences.service";
import { CodingAgentProviderRegistry } from "./coding-agent-provider-registry.service";
import { AgentHookEvent, HookDetails } from "./ports";
import {
  CODING_AGENT_STATUS_ACTION,
  parseStatusPingArgs,
} from "./providers/_shared/hook-command.builder";

export type ActiveAgent = {
  readonly terminalId: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly status: AgentStatus;
  /** When `status` last changed (epoch ms). */
  readonly statusSince: number;
  readonly cwd?: string;
  /** The prompt the agent is working on, first line. */
  readonly task?: string;
  /** The last thing it did or asked: a tool call, a question, an error. */
  readonly activity?: string;
  /** The agent's closing message once it stopped. */
  readonly result?: string;
  /** Subagents currently running under this agent. */
  readonly subagentCount: number;
  readonly placement?: TerminalPlacement;
};

/** Which state needs the user, strongest first. Drives the side-menu badge. */
export type AgentAttention = "error" | "question" | undefined;

const STATUS_NOTIFICATION_HEADERS: Record<AgentStatus, string> = {
  working: "Agent started working",
  question: "Agent has a question",
  ready: "Agent is ready",
  error: "Agent reported an error",
};

/**
 * How long a "ready" has to stand before the card shows it. An agent that stops
 * with a harness notification already queued (a background command finished during
 * its turn) is woken right away; the gap is one hook process start, about a second
 * on Windows. Showing that stop would make the card flicker.
 */
const READY_GRACE_MS = 2000;

/** Id given to a subagent whose provider reports none, so a later stop can end it. */
const ANONYMOUS_SUBAGENT_PREFIX = "anonymous-";

type AgentIdentity = Pick<ActiveAgent, "providerId" | "providerName">;

/** Everything the service tracks for one terminal, cleaned up as one. */
type TerminalAgentState = {
  agent: ActiveAgent;
  /** Sequence of the newest status ping applied; older ones are stale. */
  lastSeq: number;
  subagentIds: Set<string>;
  /** The main agent reported "ready" while subagents were still running. */
  readyDeferred: boolean;
  readyTimer?: ReturnType<typeof setTimeout>;
};

/**
 * What the card shows for a reported status. "Ready" is the one status held back:
 * while subagents run the task is not done, and a ready that follows work waits
 * out the grace period. A terminal's first status shows at once.
 */
export function resolveShownStatus(
  reported: AgentStatus,
  subagentsRunning: boolean,
  shownBefore: AgentStatus | undefined,
): { readonly status: AgentStatus; readonly settleReady: boolean } {
  if (reported !== "ready") return { status: reported, settleReady: false };
  if (subagentsRunning) return { status: "working", settleReady: false };
  if (shownBefore !== undefined && shownBefore !== "ready") {
    return { status: shownBefore, settleReady: true };
  }
  return { status: "ready", settleReady: false };
}

@Injectable({ providedIn: "root" })
export class CodingAgentStatusService {
  private readonly states = new Map<string, TerminalAgentState>();
  private anonymousSubagents = 0;
  private readonly _activeAgents = signal<ReadonlyArray<ActiveAgent>>([]);

  readonly activeAgents: Signal<ReadonlyArray<ActiveAgent>> = this._activeAgents.asReadonly();
  readonly attention: Signal<AgentAttention> = computed(() => {
    const agents = this._activeAgents();
    if (agents.some((agent) => agent.status === "error")) return "error";
    if (agents.some((agent) => agent.status === "question")) return "question";
    return undefined;
  });

  constructor(
    ipc: TerminalIpcPort,
    private readonly animation: TerminalAnimationPort,
    configPort: ApplicationConfigurationPort,
    private readonly registry: CodingAgentProviderRegistry,
    private readonly monitor: TerminalMonitorPort,
    private readonly placement: TerminalPlacementPort,
    destroyRef: DestroyRef,
    private readonly notificationCenterPort: NotificationCenterPort,
    private readonly notificationPreferences: CodingAgentNotificationPreferencesService,
  ) {
    const config = configPort.getConfiguration() as {
      feature?: { coding_agents?: { mode?: string } };
    };
    if (config?.feature?.coding_agents?.mode === "off") return;

    ipc.messages$
      .pipe(
        filter(
          (m): m is TerminalIpcMessage & { terminalId: string } =>
            m.command === CODING_AGENT_STATUS_ACTION &&
            !!m.terminalId &&
            monitor.isTerminalActive(m.terminalId),
        ),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((message) => this.onStatusPing(message));

    monitor.cwdChanges$.pipe(takeUntilDestroyed(destroyRef)).subscribe(({ terminalId, cwd }) => {
      const state = this.states.get(terminalId);
      if (!state || state.agent.cwd === cwd) return;
      state.agent = { ...state.agent, cwd };
      this.publish();
    });

    placement.changes$.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      if (this.states.size === 0) return;
      for (const [terminalId, state] of this.states) {
        state.agent = { ...state.agent, placement: placement.getPlacement(terminalId) };
      }
      this.publish();
    });

    merge(
      monitor.activity$.pipe(
        filter(({ isBusy }) => !isBusy),
        map(({ terminalId }) => terminalId),
      ),
      monitor.terminated$,
    )
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((terminalId) => this.forget(terminalId));

    destroyRef.onDestroy(() => {
      for (const state of this.states.values()) this.clearReadyTimer(state);
    });
  }

  private onStatusPing({
    terminalId,
    args,
    payload,
  }: TerminalIpcMessage & { terminalId: string }): void {
    const ping = parseStatusPingArgs(args);
    const provider = this.registry.providers.find((p) => p.id === ping.providerId);
    const identity: AgentIdentity = {
      providerId: ping.providerId,
      providerName: provider?.name ?? ping.providerId,
    };
    // A provider that is not registered can still report its status; its payload
    // stays unread.
    const event: AgentHookEvent = provider
      ? provider.interpretHook(ping.hookEvent, ping.status, payload)
      : { kind: "status", status: ping.status, sessionBoundary: false, details: {} };

    if (event.kind === "subagent") this.onSubagentEvent(terminalId, identity, event);
    else this.onAgentStatus(terminalId, identity, ping.seq, event);
  }

  /**
   * A subagent starting or stopping says nothing about the main agent's status -
   * it keeps working while they run - so only the count moves. Not subject to the
   * sequence guard: hooks run as parallel processes, and a late start must not be
   * dropped as stale.
   */
  private onSubagentEvent(
    terminalId: string,
    identity: AgentIdentity,
    event: Extract<AgentHookEvent, { kind: "subagent" }>,
  ): void {
    let state = this.states.get(terminalId);
    if (!state) {
      // A stop for an agent never seen means nothing. A start is the first sign of
      // this agent (Cogno started while it was already running): it is working.
      if (event.change === "stop") return;
      state = this.createState(terminalId, identity, "working");
    }

    if (event.change === "start") {
      state.subagentIds.add(event.agentId ?? this.anonymousSubagentId());
    } else {
      this.removeSubagent(state.subagentIds, event.agentId);
    }
    const subagentCount = state.subagentIds.size;
    // The last subagent stopping does not finish the task: the main agent is woken
    // to take up the results and reports its own stop afterwards. Until then the
    // card keeps saying "working".
    if (subagentCount === 0) state.readyDeferred = false;

    state.agent = { ...state.agent, subagentCount };
    this.publish();
  }

  private onAgentStatus(
    terminalId: string,
    identity: AgentIdentity,
    seq: number,
    event: Extract<AgentHookEvent, { kind: "status" }>,
  ): void {
    const shownBefore = this.states.get(terminalId)?.agent.status;
    const state =
      this.states.get(terminalId) ?? this.createState(terminalId, identity, event.status);
    if (seq > 0 && seq < state.lastSeq) return;
    if (seq > 0) state.lastSeq = seq;

    if (event.sessionBoundary) {
      state.subagentIds.clear();
      state.readyDeferred = false;
    }
    if (event.details.task !== undefined) state.readyDeferred = false;
    const subagentsRunning = state.subagentIds.size > 0;
    if (event.status === "ready" && subagentsRunning) state.readyDeferred = true;

    const shown = resolveShownStatus(event.status, subagentsRunning, shownBefore);
    this.clearReadyTimer(state);
    if (shown.settleReady) {
      state.readyTimer = setTimeout(() => this.settleReady(terminalId), READY_GRACE_MS);
    }

    state.agent = {
      ...state.agent,
      ...identity,
      status: shown.status,
      statusSince: shownBefore === shown.status ? state.agent.statusSince : Date.now(),
      cwd: this.monitor.getCwd(terminalId),
      ...this.mergeDetails(
        state.agent,
        event.status === "ready" || state.readyDeferred,
        event.details,
      ),
      subagentCount: state.subagentIds.size,
      placement: this.placement.getPlacement(terminalId),
    };
    this.animation.register(
      terminalId,
      AGENT_STATUS_REGISTRATION_KEY,
      AGENT_STATUS_SPECS[shown.status],
    );
    this.publish();

    if (shownBefore !== undefined && shownBefore !== shown.status) {
      this.notifyStatusChanged(identity.providerName, shown.status);
    }
  }

  /** The grace period passed without new work: the task is done. */
  private settleReady(terminalId: string): void {
    const state = this.states.get(terminalId);
    if (!state) return;
    state.readyTimer = undefined;
    if (state.agent.status === "ready") return;
    if (state.subagentIds.size > 0) {
      state.readyDeferred = true;
      return;
    }
    state.agent = { ...state.agent, status: "ready", statusSince: Date.now() };
    this.animation.register(terminalId, AGENT_STATUS_REGISTRATION_KEY, AGENT_STATUS_SPECS.ready);
    this.publish();
    this.notifyStatusChanged(state.agent.providerName, "ready");
  }

  /**
   * A new prompt starts a fresh task: activity and result are cleared. Otherwise a
   * hook without usable detail keeps what was known. The result is kept only while
   * the agent is ready, or while its "ready" is merely deferred by running
   * subagents, whose tool hooks would otherwise wipe it before the card shows it.
   */
  private mergeDetails(
    existing: ActiveAgent,
    keepResult: boolean,
    details: HookDetails,
  ): Pick<ActiveAgent, "task" | "activity" | "result"> {
    if (details.task !== undefined) {
      return { task: details.task, activity: undefined, result: undefined };
    }
    return {
      task: existing.task,
      activity: details.activity ?? existing.activity,
      result: keepResult ? (details.result ?? existing.result) : undefined,
    };
  }

  private createState(
    terminalId: string,
    identity: AgentIdentity,
    status: AgentStatus,
  ): TerminalAgentState {
    const state: TerminalAgentState = {
      agent: {
        terminalId,
        ...identity,
        status,
        statusSince: Date.now(),
        cwd: this.monitor.getCwd(terminalId),
        subagentCount: 0,
        placement: this.placement.getPlacement(terminalId),
      },
      lastSeq: 0,
      subagentIds: new Set(),
      readyDeferred: false,
    };
    this.states.set(terminalId, state);
    return state;
  }

  private forget(terminalId: string): void {
    const state = this.states.get(terminalId);
    if (!state) return;
    this.clearReadyTimer(state);
    this.states.delete(terminalId);
    this.publish();
  }

  private anonymousSubagentId(): string {
    return `${ANONYMOUS_SUBAGENT_PREFIX}${++this.anonymousSubagents}`;
  }

  /** A stop names its agent when the provider reports ids; without one it ends the oldest anonymous start. */
  private removeSubagent(ids: Set<string>, agentId: string | undefined): void {
    if (agentId !== undefined) {
      ids.delete(agentId);
      return;
    }
    const anonymous = [...ids].find((id) => id.startsWith(ANONYMOUS_SUBAGENT_PREFIX));
    if (anonymous !== undefined) ids.delete(anonymous);
  }

  private clearReadyTimer(state: TerminalAgentState): void {
    if (state.readyTimer === undefined) return;
    clearTimeout(state.readyTimer);
    state.readyTimer = undefined;
  }

  private publish(): void {
    this._activeAgents.set([...this.states.values()].map((state) => state.agent));
  }

  private notifyStatusChanged(providerName: string, status: AgentStatus): void {
    if (!this.notificationPreferences.shouldNotify(status)) return;

    this.notificationCenterPort.dispatch({
      header: STATUS_NOTIFICATION_HEADERS[status],
      body: providerName || undefined,
      type: this.getNotificationType(status),
      timestamp: new Date(),
      channels: this.notificationPreferences.getActiveChannels(),
    });
  }

  private getNotificationType(status: AgentStatus): NotificationTypeContract {
    switch (status) {
      case "error":
        return "error";
      case "question":
        return "warning";
      case "ready":
        return "success";
      default:
        return "info";
    }
  }
}
