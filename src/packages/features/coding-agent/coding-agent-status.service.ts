import { DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ApplicationConfigurationPort,
  parseAgentStatus,
  TerminalAnimationPort,
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
  readonly status: "working" | "question" | "error";
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

    ipc.messages$.pipe(
      filter((m) => m.command === CODING_AGENT_STATUS_ACTION && !!m.terminalId),
      takeUntilDestroyed(destroyRef),
    ).subscribe(({ terminalId, args }) => {
      const status = parseAgentStatus(args?.[0] ?? "") ?? "ready";
      const providerId = args?.[1] ?? "";

      animation.register(terminalId!, AGENT_STATUS_REGISTRATION_KEY, AGENT_STATUS_SPECS[status]);

      if (status === "ready") {
        this.agentsMap.delete(terminalId!);
      } else {
        const providerName = registry.providers.find((p) => p.id === providerId)?.name ?? providerId;
        this.agentsMap.set(terminalId!, { terminalId: terminalId!, providerId, providerName, status });
      }
      this.syncActiveAgents();
    });

    merge(
      monitor.activity$.pipe(filter(({ isBusy }) => !isBusy), map(({ terminalId }) => terminalId)),
      monitor.terminated$,
    ).pipe(takeUntilDestroyed(destroyRef)).subscribe((terminalId) => {
      if (this.agentsMap.delete(terminalId)) this.syncActiveAgents();
    });
  }

  private syncActiveAgents(): void {
    this._activeAgents.set([...this.agentsMap.values()]);
  }
}
