import { computed, DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import { TerminalAnimationPort } from "@cogno/core/api/terminal-animation-port";
import { TerminalMonitorPort } from "@cogno/core/api/terminal-monitor-port";
import { TerminalPlacement, TerminalPlacementPort } from "@cogno/core/api/terminal-placement-port";
import { TerminalProcess, TerminalProcessesPort } from "@cogno/core/api/terminal-processes-port";
import { NotificationTypeContract } from "@cogno/shared/domain";
import { filter, map, merge, Subscription } from "rxjs";
import { bindSession } from "./agent-session-binder";
import { AgentStatus } from "./agent-status";
import { AGENT_STATUS_REGISTRATION_KEY, AGENT_STATUS_SPECS } from "./coding-agent-animation";
import { CodingAgentNotificationPreferencesService } from "./coding-agent-notification-preferences.service";
import { CodingAgentProviderRegistry } from "./coding-agent-provider-registry.service";
import { AgentHookEvent, AgentSessionEvent, HookDetails, ICodingAgentProvider } from "./ports";

export type ActiveAgent = {
  /** The agent's own session id; what a card is tracked by. */
  readonly sessionId: string;
  readonly providerId: string;
  readonly providerName: string;
  /** The terminal the session runs in, once known. */
  readonly terminalId?: string;
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
  /** The model it runs on, once its provider reported one. */
  readonly model?: string;
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

/**
 * How often sessions without a terminal are matched against the terminals'
 * processes again, and checked to still run at all.
 */
const UNBOUND_POLL_MS = 3000;

/**
 * A session no terminal of Cogno's runs (an agent in another program's
 * terminal reaches Cogno over the endpoint file too) is ignored. The id is
 * kept this long: a resumed session may come back in a Cogno terminal.
 */
const FOREIGN_SESSION_TTL_MS = 60_000;

/** Id given to a subagent whose provider reports none, so a later stop can end it. */
const ANONYMOUS_SUBAGENT_PREFIX = "anonymous-";

/** Everything the service tracks for one session, cleaned up as one. */
type SessionState = {
  agent: ActiveAgent;
  provider: ICodingAgentProvider;
  /** Unix milliseconds of the first event. */
  firstSeenAt: number;
  /**
   * Whether the card may show: a session that arrived without a terminal is
   * held back until the first match against the terminals' processes said
   * whether a Cogno terminal runs it at all.
   */
  shown: boolean;
  /** When the newest status event applied was sent; older ones are stale. */
  lastSentAt: number;
  subagentIds: Set<string>;
  /** The main agent reported "ready" while subagents were still running. */
  readyDeferred: boolean;
  readyTimer?: ReturnType<typeof setTimeout>;
};

/**
 * What the card shows for a reported status. "Ready" is the one status held back:
 * while subagents run the task is not done, and a ready that follows work waits
 * out the grace period. A session's first status shows at once.
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

/**
 * The agents' sessions, keyed by the session each agent names itself
 * (ARCHITECTURE.md 3.2). A session that arrives with its terminal (the hook
 * ran in it) is placed at once; one without is matched to a terminal by the
 * agent's process in the session's folder, shown without a placement when
 * several terminals come into question, and dropped when none does.
 */
@Injectable({ providedIn: "root" })
export class CodingAgentStatusService {
  private readonly states = new Map<string, SessionState>();
  /** Sessions no Cogno terminal runs, with when to look again. */
  private readonly foreign = new Map<string, number>();
  private anonymousSubagents = 0;
  private running?: Subscription;
  private unboundPoll?: ReturnType<typeof setInterval>;
  private matching = false;
  private matchAgain = false;
  private readonly _activeAgents = signal<ReadonlyArray<ActiveAgent>>([]);

  readonly activeAgents: Signal<ReadonlyArray<ActiveAgent>> = this._activeAgents.asReadonly();
  readonly attention: Signal<AgentAttention> = computed(() => {
    const agents = this._activeAgents();
    if (agents.some((agent) => agent.status === "error")) return "error";
    if (agents.some((agent) => agent.status === "question")) return "question";
    return undefined;
  });

  constructor(
    private readonly animation: TerminalAnimationPort,
    private readonly registry: CodingAgentProviderRegistry,
    private readonly monitor: TerminalMonitorPort,
    private readonly placement: TerminalPlacementPort,
    private readonly processes: TerminalProcessesPort,
    destroyRef: DestroyRef,
    private readonly notificationCenterPort: NotificationCenterPort,
    private readonly notificationPreferences: CodingAgentNotificationPreferencesService,
  ) {
    destroyRef.onDestroy(() => this.stop());
  }

  /** Follows the agents from now on - the feature was switched on. */
  start(): void {
    if (this.running) return;
    const running = new Subscription();
    this.running = running;

    running.add(
      merge(
        ...this.registry.providers.map((provider) =>
          provider.events$.pipe(map((event) => ({ provider, event }))),
        ),
      ).subscribe(({ provider, event }) => this.onSessionEvent(provider, event)),
    );

    running.add(
      this.monitor.cwdChanges$.subscribe(({ terminalId, cwd }) => {
        let changed = false;
        for (const state of this.states.values()) {
          if (state.agent.terminalId !== terminalId || state.agent.cwd === cwd) continue;
          state.agent = { ...state.agent, cwd };
          changed = true;
        }
        if (changed) this.publish();
      }),
    );

    running.add(
      this.placement.changes$.subscribe(() => {
        if (this.states.size === 0) return;
        for (const state of this.states.values()) {
          state.agent = { ...state.agent, placement: this.placementOf(state.agent.terminalId) };
        }
        this.publish();
      }),
    );

    // The agent runs in the terminal's foreground: when the shell is back at
    // its prompt, or the terminal is gone, so is the agent.
    running.add(
      merge(
        this.monitor.activity$.pipe(
          filter(({ isBusy }) => !isBusy),
          map(({ terminalId }) => terminalId),
        ),
        this.monitor.terminated$,
      ).subscribe((terminalId) => this.forgetTerminal(terminalId)),
    );
  }

  /** Stops following the agents and takes their cards and tab icons away - the feature was switched off. */
  stop(): void {
    this.running?.unsubscribe();
    this.running = undefined;
    this.stopUnboundPoll();
    for (const state of this.states.values()) {
      this.clearReadyTimer(state);
      this.unregisterAnimation(state);
    }
    this.states.clear();
    this.foreign.clear();
    this.publish();
  }

  private onSessionEvent(provider: ICodingAgentProvider, event: AgentSessionEvent): void {
    const key = this.keyOf(provider, event.sessionId);
    const foreignUntil = this.foreign.get(key);
    if (foreignUntil !== undefined) {
      if (foreignUntil > Date.now()) return;
      this.foreign.delete(key);
    }
    // A terminal from the hook's environment counts only when this window has
    // it: a daemon's environment may name a terminal of an earlier launch.
    const terminalId =
      event.terminalId && this.monitor.isTerminalActive(event.terminalId)
        ? event.terminalId
        : undefined;

    const hook = event.event;
    if (hook.kind === "subagent") this.onSubagentEvent(key, provider, event, terminalId, hook);
    else if (hook.kind === "model") this.onModelSwitch(key, hook.model);
    else this.onAgentStatus(key, provider, event, terminalId, hook);
  }

  /** A model switch changes only the model; a session never seen stays unknown. */
  private onModelSwitch(key: string, model: string | undefined): void {
    const state = this.states.get(key);
    if (!state || !model) return;
    state.agent = { ...state.agent, model };
    this.publish();
  }

  /**
   * A subagent starting or stopping says nothing about the main agent's status -
   * it keeps working while they run - so only the count moves. Not subject to the
   * sequence guard: hooks run as parallel processes, and a late start must not be
   * dropped as stale.
   */
  private onSubagentEvent(
    key: string,
    provider: ICodingAgentProvider,
    event: AgentSessionEvent,
    terminalId: string | undefined,
    hook: Extract<AgentHookEvent, { kind: "subagent" }>,
  ): void {
    let state = this.states.get(key);
    if (!state) {
      // A stop for a session never seen means nothing. A start is the first sign of
      // this session (Cogno started while it was already running): it is working.
      if (hook.change === "stop") return;
      state = this.createState(key, provider, event, terminalId, "working");
      this.registerAnimation(state);
    }

    if (hook.change === "start") {
      state.subagentIds.add(hook.agentId ?? this.anonymousSubagentId());
    } else {
      this.removeSubagent(state.subagentIds, hook.agentId);
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
    key: string,
    provider: ICodingAgentProvider,
    event: AgentSessionEvent,
    terminalId: string | undefined,
    hook: Extract<AgentHookEvent, { kind: "status" }>,
  ): void {
    const existing = this.states.get(key);
    const shownBefore = existing?.agent.status;
    const state = existing ?? this.createState(key, provider, event, terminalId, hook.status);
    if (event.sentAt > 0 && event.sentAt < state.lastSentAt) return;
    if (event.sentAt > 0) state.lastSentAt = event.sentAt;

    // A user's prompt also starts over: a subagent whose stop never came (the
    // turn was interrupted, a hook failed) must not keep the card working. A
    // subagent that still runs then ends uncounted.
    if (hook.sessionBoundary || hook.details.task !== undefined) {
      state.subagentIds.clear();
      state.readyDeferred = false;
    }
    const subagentsRunning = state.subagentIds.size > 0;
    if (hook.status === "ready" && subagentsRunning) state.readyDeferred = true;

    const shown = resolveShownStatus(hook.status, subagentsRunning, shownBefore);
    this.clearReadyTimer(state);
    if (shown.settleReady) {
      state.readyTimer = setTimeout(() => this.settleReady(key), READY_GRACE_MS);
    }

    state.agent = {
      ...state.agent,
      status: shown.status,
      statusSince: shownBefore === shown.status ? state.agent.statusSince : Date.now(),
      cwd: event.cwd ?? state.agent.cwd,
      ...this.mergeDetails(
        state.agent,
        hook.status === "ready" || state.readyDeferred,
        hook.details,
      ),
      subagentCount: state.subagentIds.size,
    };
    this.registerAnimation(state);
    this.publish();

    if (state.shown && shownBefore !== undefined && shownBefore !== shown.status) {
      this.notifyStatusChanged(provider.name, shown.status);
    }
  }

  /** The grace period passed without new work: the task is done. */
  private settleReady(key: string): void {
    const state = this.states.get(key);
    if (!state) return;
    state.readyTimer = undefined;
    if (state.agent.status === "ready") return;
    if (state.subagentIds.size > 0) {
      state.readyDeferred = true;
      return;
    }
    state.agent = { ...state.agent, status: "ready", statusSince: Date.now() };
    this.registerAnimation(state);
    this.publish();
    if (state.shown) this.notifyStatusChanged(state.provider.name, "ready");
  }

  /**
   * A new prompt starts a fresh task: activity and result are cleared.
   * Otherwise a hook without usable detail keeps what was known. The result is kept
   * only while the agent is ready, or while its "ready" is merely deferred by running
   * subagents, whose tool hooks would otherwise wipe it before the card shows it.
   * The model belongs to the session, not the task: it stays until another is reported.
   */
  private mergeDetails(
    existing: ActiveAgent,
    keepResult: boolean,
    details: HookDetails,
  ): Pick<ActiveAgent, "task" | "activity" | "result" | "model"> {
    const model = details.model ?? existing.model;
    if (details.task !== undefined) {
      return {
        task: details.task,
        activity: undefined,
        result: undefined,
        model,
      };
    }
    return {
      task: existing.task,
      activity: details.activity ?? existing.activity,
      result: keepResult ? (details.result ?? existing.result) : undefined,
      model,
    };
  }

  private createState(
    key: string,
    provider: ICodingAgentProvider,
    event: AgentSessionEvent,
    terminalId: string | undefined,
    status: AgentStatus,
  ): SessionState {
    const state: SessionState = {
      agent: {
        sessionId: event.sessionId,
        providerId: provider.id,
        providerName: provider.name,
        status,
        statusSince: Date.now(),
        cwd: event.cwd ?? (terminalId ? this.monitor.getCwd(terminalId) : undefined),
        subagentCount: 0,
      },
      provider,
      firstSeenAt: Date.now(),
      shown: terminalId !== undefined,
      lastSentAt: 0,
      subagentIds: new Set(),
      readyDeferred: false,
    };
    this.states.set(key, state);
    if (terminalId) this.bindTo(state, terminalId);
    else this.matchUnbound();
    return state;
  }

  /** The session runs in this terminal; whatever ran there before is over. */
  private bindTo(state: SessionState, terminalId: string): void {
    for (const [otherKey, other] of this.states) {
      if (other !== state && other.agent.terminalId === terminalId) this.forget(otherKey);
    }
    state.agent = {
      ...state.agent,
      terminalId,
      cwd: state.agent.cwd ?? this.monitor.getCwd(terminalId),
      placement: this.placementOf(terminalId),
    };
    state.shown = true;
    this.registerAnimation(state);
  }

  /**
   * Matches every session without a terminal against the terminals'
   * processes: bound when one terminal runs it, kept without placement when
   * several do, dropped when none does. Runs one snapshot at a time; a
   * request during a run makes it run once more.
   */
  private matchUnbound(): void {
    if (this.matching) {
      this.matchAgain = true;
      return;
    }
    this.matching = true;
    this.processes
      .snapshot()
      .then((processes) => this.applyProcesses(processes))
      .catch((error: unknown) => {
        console.warn("[coding-agent] could not read the terminals' processes:", error);
      })
      .finally(() => {
        this.matching = false;
        if (this.matchAgain) {
          this.matchAgain = false;
          this.matchUnbound();
        } else {
          this.updateUnboundPoll();
        }
      });
  }

  private applyProcesses(processes: ReadonlyArray<TerminalProcess>): void {
    if (!this.running) return;
    const taken = new Set(
      [...this.states.values()]
        .map((state) => state.agent.terminalId)
        .filter((id): id is string => id !== undefined),
    );
    let changed = false;
    for (const [key, state] of this.states) {
      if (state.agent.terminalId !== undefined) continue;
      const session = { cwd: state.agent.cwd, firstSeenAt: state.firstSeenAt };
      const binding = bindSession(processes, session, state.provider.processNames, taken);
      if (binding.kind === "bound") {
        this.bindTo(state, binding.terminalId);
        taken.add(binding.terminalId);
        changed = true;
      } else if (binding.kind === "none") {
        // Nothing of Cogno's runs it: another program's terminal does.
        this.clearReadyTimer(state);
        this.states.delete(key);
        this.foreign.set(key, Date.now() + FOREIGN_SESSION_TTL_MS);
        changed = true;
      } else if (!state.shown) {
        state.shown = true;
        changed = true;
      }
    }
    if (changed) this.publish();
  }

  /** Sessions without a terminal are looked at again now and then, as long as there are any. */
  private updateUnboundPoll(): void {
    const hasUnbound = [...this.states.values()].some(
      (state) => state.agent.terminalId === undefined,
    );
    if (hasUnbound && this.running && !this.unboundPoll) {
      this.unboundPoll = setInterval(() => this.matchUnbound(), UNBOUND_POLL_MS);
    } else if (!hasUnbound) {
      this.stopUnboundPoll();
    }
  }

  private stopUnboundPoll(): void {
    if (this.unboundPoll === undefined) return;
    clearInterval(this.unboundPoll);
    this.unboundPoll = undefined;
  }

  private forgetTerminal(terminalId: string): void {
    for (const [key, state] of this.states) {
      if (state.agent.terminalId === terminalId) this.forget(key);
    }
  }

  private forget(key: string): void {
    const state = this.states.get(key);
    if (!state) return;
    this.clearReadyTimer(state);
    this.unregisterAnimation(state);
    this.states.delete(key);
    this.publish();
  }

  private keyOf(provider: ICodingAgentProvider, sessionId: string): string {
    return `${provider.id}:${sessionId}`;
  }

  private placementOf(terminalId: string | undefined): TerminalPlacement | undefined {
    return terminalId ? this.placement.getPlacement(terminalId) : undefined;
  }

  private registerAnimation(state: SessionState): void {
    if (!state.agent.terminalId) return;
    this.animation.register(
      state.agent.terminalId,
      AGENT_STATUS_REGISTRATION_KEY,
      AGENT_STATUS_SPECS[state.agent.status],
    );
  }

  private unregisterAnimation(state: SessionState): void {
    if (!state.agent.terminalId) return;
    this.animation.unregister(state.agent.terminalId, AGENT_STATUS_REGISTRATION_KEY);
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

  private clearReadyTimer(state: SessionState): void {
    if (state.readyTimer === undefined) return;
    clearTimeout(state.readyTimer);
    state.readyTimer = undefined;
  }

  private publish(): void {
    this._activeAgents.set(
      [...this.states.values()].filter((state) => state.shown).map((state) => state.agent),
    );
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
