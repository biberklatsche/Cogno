import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AnimationSpec, TerminalAnimationPort } from "@cogno/core/api/terminal-animation-port";
import { TerminalMonitorPort } from "@cogno/core/api/terminal-monitor-port";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";

@Injectable({ providedIn: "root" })
export class TerminalAnimationAdapterService extends TerminalAnimationPort {
  constructor(
    private readonly bus: AppBus,
    monitor: TerminalMonitorPort,
    destroyRef: DestroyRef,
  ) {
    super();

    monitor.activity$.pipe(takeUntilDestroyed(destroyRef)).subscribe((e) => {
      if (!e.isBusy) this.clearForTerminal(e.terminalId);
    });

    monitor.terminated$.pipe(takeUntilDestroyed(destroyRef)).subscribe((terminalId) => {
      this.clearForTerminal(terminalId);
    });
  }

  register(terminalId: string, registrationKey: string, spec: AnimationSpec): void {
    this.bus.publish({
      type: "BusyIndicatorRegister",
      payload: {
        registrationId: `${registrationKey}-${terminalId}`,
        terminalId,
        keyframes: spec.keyframes,
        priority: spec.priority,
      },
    });
  }

  unregister(terminalId: string, registrationKey: string): void {
    this.bus.publish({
      type: "BusyIndicatorUnregister",
      payload: { registrationId: `${registrationKey}-${terminalId}` },
    });
  }

  private clearForTerminal(terminalId: string): void {
    this.bus.publish({
      type: "BusyIndicatorClearForTerminal",
      payload: { terminalId },
    });
  }
}
