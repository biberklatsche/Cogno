import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ConfirmDialogPort,
  ICodingAgentProvider,
  OsPlatformPort,
  TerminalAnimationPort,
  TerminalLinkPatternPort,
  TerminalMonitorPort,
} from "@cogno/core-api";
import { AGENT_STATUS_REGISTRATION_KEY, AGENT_STATUS_SPECS } from "./coding-agent-animation";
import { CodingAgentDetectionService } from "./coding-agent-detection.service";

@Injectable({ providedIn: "root" })
export class CodingAgentActivationService {
  // Terminals where the user was already prompted about hook installation.
  private readonly promptedTerminals = new Set<string>();

  constructor(
    detection: CodingAgentDetectionService,
    monitor: TerminalMonitorPort,
    private readonly animationPort: TerminalAnimationPort,
    private readonly linkPatternPort: TerminalLinkPatternPort,
    private readonly confirmDialog: ConfirmDialogPort,
    private readonly osPort: OsPlatformPort,
    destroyRef: DestroyRef,
  ) {
    detection.detected$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(({ terminalId, provider }) => {
        if (provider.resumeLinkPattern) {
          this.linkPatternPort.setPattern(terminalId, provider.resumeLinkPattern);
        }
        this.animationPort.register(
          terminalId,
          AGENT_STATUS_REGISTRATION_KEY,
          AGENT_STATUS_SPECS.working,
        );
        void this.offerHookInstallation(terminalId, provider);
      });

    monitor.terminated$.pipe(takeUntilDestroyed(destroyRef)).subscribe((terminalId) => {
      this.promptedTerminals.delete(terminalId);
      this.linkPatternPort.clearPattern(terminalId);
    });
  }

  private async offerHookInstallation(
    terminalId: string,
    provider: ICodingAgentProvider,
  ): Promise<void> {
    if (this.promptedTerminals.has(terminalId)) return;
    this.promptedTerminals.add(terminalId);

    let alreadyInstalled = false;
    try {
      alreadyInstalled = await provider.isHookInstalled();
    } catch {
      alreadyInstalled = false;
    }
    if (alreadyInstalled) return;

    const confirmed = await this.confirmDialog
      .confirm(
        "Coding agent detected",
        `${provider.name} is running in this terminal. Install a hook to monitor the agent status?`,
      )
      .catch(() => false);

    if (!confirmed) return;

    try {
      await provider.installHook(this.osPort.platform());
    } catch (err) {
      console.error(`[coding-agent] Failed to install hook for ${provider.name}:`, err);
    }
  }
}
