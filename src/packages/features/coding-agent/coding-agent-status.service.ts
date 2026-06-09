import { DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ApplicationConfigurationPort,
  parseAgentStatus,
  TerminalAnimationPort,
  TerminalIpcMessage,
  TerminalIpcPort,
  TerminalMonitorPort,
} from "@cogno/core-api";
import { filter, map, merge } from "rxjs";
import { AGENT_STATUS_REGISTRATION_KEY, AGENT_STATUS_SPECS } from "./coding-agent-animation";
import { CodingAgentProviderRegistry } from "./coding-agent-provider-registry.service";
import { CODING_AGENT_STATUS_ACTION } from "./providers/_shared/hook-command.builder";

export type ActiveAgent = {
  readonly terminalId: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly status: "ready" | "working" | "question" | "error";
  readonly cwd?: string;
  readonly lastHook?: string;
};

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
      .subscribe(({ terminalId, args }) => {
        const status = parseAgentStatus(args?.[0] ?? "") ?? "ready";
        const providerId = args?.[1] ?? "";
        const lastHook = args?.[2] || undefined;

        animation.register(terminalId, AGENT_STATUS_REGISTRATION_KEY, AGENT_STATUS_SPECS[status]);

        const providerName =
          registry.providers.find((p) => p.id === providerId)?.name ?? providerId;
        this.agentsMap.set(terminalId, {
          terminalId,
          providerId,
          providerName,
          status,
          cwd: monitor.getCwd(terminalId),
          lastHook,
        });
        this.syncActiveAgents();
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
}
