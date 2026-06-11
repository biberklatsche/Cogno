import { DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ApplicationConfigurationPort,
  NotificationCenterPort,
  parseAgentStatus,
  TerminalAnimationPort,
  TerminalIpcMessage,
  TerminalIpcPort,
  TerminalMonitorPort,
} from "@cogno/core-api";
import { filter, map, merge } from "rxjs";
import { AGENT_STATUS_REGISTRATION_KEY, AGENT_STATUS_SPECS } from "./coding-agent-animation";
import { CodingAgentNotificationPreferencesService } from "./coding-agent-notification-preferences.service";
import { CodingAgentProviderRegistry } from "./coding-agent-provider-registry.service";
import { CODING_AGENT_STATUS_ACTION } from "./providers/_shared/hook-command.builder";

const STATUS_NOTIFICATION_HEADERS: Record<ActiveAgent["status"], string> = {
  working: "Agent started working",
  question: "Agent has a question",
  ready: "Agent is ready",
  error: "Agent reported an error",
};

export type ActiveAgent = {
  readonly terminalId: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly status: "ready" | "working" | "question" | "error";
  readonly cwd?: string;
  readonly lastHook?: string;
  readonly activity?: string;
};

const ACTIVITY_MAX_LENGTH = 80;

/**
 * Derives a short "what's it doing" one-liner from a Claude/Codex-style hook payload
 * (`{ tool_name, tool_input: {...} }`). Returns `undefined` when the payload doesn't
 * carry a usable tool call — callers should keep the previously known activity in that case.
 */
function extractActivity(
  payload: unknown,
  terminalId: string,
  hookEvent?: string,
): string | undefined {
  if (typeof payload === "string") {
    if (payload.startsWith("omitted:")) {
      console.warn(
        `[coding-agent-status] payload omitted for terminal ${terminalId} (${hookEvent}): ${payload}`,
      );
    }
    return undefined;
  }

  if (!payload || typeof payload !== "object") return undefined;

  const { tool_name: toolName, tool_input: toolInput } = payload as {
    tool_name?: unknown;
    tool_input?: Record<string, unknown>;
  };

  const candidate =
    toolInput?.["command"] ??
    toolInput?.["file_path"] ??
    toolInput?.["pattern"] ??
    toolInput?.["description"];

  if (typeof candidate !== "string" || !candidate) return undefined;

  const text =
    candidate.length > ACTIVITY_MAX_LENGTH
      ? `${candidate.slice(0, ACTIVITY_MAX_LENGTH - 1)}…`
      : candidate;

  return typeof toolName === "string" && toolName ? `${toolName}: ${text}` : text;
}

@Injectable({ providedIn: "root" })
export class CodingAgentStatusService {
  private readonly agentsMap = new Map<string, ActiveAgent>();
  private readonly _activeAgents = signal<ReadonlyArray<ActiveAgent>>([]);

  readonly activeAgents: Signal<ReadonlyArray<ActiveAgent>> = this._activeAgents.asReadonly();

  constructor(
    ipc: TerminalIpcPort,
    animation: TerminalAnimationPort,
    configPort: ApplicationConfigurationPort,
    registry: CodingAgentProviderRegistry,
    monitor: TerminalMonitorPort,
    destroyRef: DestroyRef,
    private readonly notificationCenterPort: NotificationCenterPort,
    private readonly notificationPreferences: CodingAgentNotificationPreferencesService,
  ) {
    const config = configPort.getConfiguration() as { coding_agents?: { mode?: string } };
    if (config?.coding_agents?.mode === "off") return;

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
      .subscribe(({ terminalId, args, payload }) => {
        const status = parseAgentStatus(args?.[0] ?? "") ?? "ready";
        const providerId = args?.[1] ?? "";
        const lastHook = args?.[2] || undefined;
        const activity = extractActivity(payload, terminalId, lastHook);

        animation.register(terminalId, AGENT_STATUS_REGISTRATION_KEY, AGENT_STATUS_SPECS[status]);

        const providerName =
          registry.providers.find((p) => p.id === providerId)?.name ?? providerId;
        const existing = this.agentsMap.get(terminalId);
        this.agentsMap.set(terminalId, {
          terminalId,
          providerId,
          providerName,
          status,
          cwd: monitor.getCwd(terminalId),
          lastHook,
          activity: activity ?? existing?.activity,
        });
        this.syncActiveAgents();

        if (existing && existing.status !== status) {
          this.notifyStatusChanged(providerName, status);
        }
      });

    monitor.cwdChanges$.pipe(takeUntilDestroyed(destroyRef)).subscribe(({ terminalId, cwd }) => {
      const agent = this.agentsMap.get(terminalId);
      if (!agent || agent.cwd === cwd) return;

      this.agentsMap.set(terminalId, { ...agent, cwd });
      this.syncActiveAgents();
    });

    merge(
      monitor.activity$.pipe(
        filter(({ isBusy }) => !isBusy),
        map(({ terminalId }) => terminalId),
      ),
      monitor.terminated$,
    )
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((terminalId) => {
        if (this.agentsMap.delete(terminalId)) this.syncActiveAgents();
      });
  }

  private syncActiveAgents(): void {
    this._activeAgents.set([...this.agentsMap.values()]);
  }

  private notifyStatusChanged(providerName: string, status: ActiveAgent["status"]): void {
    if (!this.notificationPreferences.shouldNotify(status)) return;

    this.notificationCenterPort.dispatch({
      header: STATUS_NOTIFICATION_HEADERS[status],
      body: providerName || undefined,
      type: status === "error" ? "warning" : "info",
      timestamp: new Date(),
      channels: this.notificationPreferences.getActiveChannels(),
    });
  }
}
