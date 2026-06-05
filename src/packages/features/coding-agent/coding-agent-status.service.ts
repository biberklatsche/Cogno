import { DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ActionDispatcher,
  ApplicationConfigurationPort,
  parseAgentStatus,
  TerminalAnimationPort,
  TerminalMonitorPort,
} from "@cogno/core-api";
import { AGENT_STATUS_REGISTRATION_KEY, AGENT_STATUS_SPECS } from "./coding-agent-animation";
import { CodingAgentProviderRegistry } from "./coding-agent-provider-registry.service";

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
    actionDispatcher: ActionDispatcher,
    animation: TerminalAnimationPort,
    configPort: ApplicationConfigurationPort,
    registry: CodingAgentProviderRegistry,
    monitor: TerminalMonitorPort,
    destroyRef: DestroyRef,
  ) {
    const config = configPort.getConfiguration() as { coding_agents?: { mode?: string } };
    if (config?.coding_agents?.mode === "off") return;

    actionDispatcher
      .onActionWithContext$("coding_agent_status")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(({ args, terminalId }) => {
        if (!terminalId) return;
        const status = parseAgentStatus(args?.[0]);
        if (!status) return;

        animation.register(terminalId, AGENT_STATUS_REGISTRATION_KEY, AGENT_STATUS_SPECS[status]);

        if (status === "ready") {
          this.agentsMap.delete(terminalId);
        } else {
          const providerId = args?.[1] ?? "";
          const providerName =
            registry.providers.find((p) => p.id === providerId)?.name ?? providerId;
          this.agentsMap.set(terminalId, { terminalId, providerId, providerName, status });
        }
        this._activeAgents.set([...this.agentsMap.values()]);
      });

    monitor.terminated$.pipe(takeUntilDestroyed(destroyRef)).subscribe((terminalId) => {
      if (this.agentsMap.delete(terminalId)) {
        this._activeAgents.set([...this.agentsMap.values()]);
      }
    });
  }
}
