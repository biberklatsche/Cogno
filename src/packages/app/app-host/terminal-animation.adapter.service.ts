import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AnimationSpec, TerminalAnimationPort, TerminalMonitorPort } from "@cogno/core-api";
import { AppBus } from "../app-bus/app-bus";

@Injectable({ providedIn: "root" })
export class TerminalAnimationAdapterService extends TerminalAnimationPort {
  private readonly activeIds = new Map<string, Set<string>>();
  private readonly idleTerminals = new Set<string>();

  constructor(
    private readonly bus: AppBus,
    monitor: TerminalMonitorPort,
    destroyRef: DestroyRef,
  ) {
    super();

    monitor.terminated$.pipe(takeUntilDestroyed(destroyRef)).subscribe((terminalId) => {
      this.idleTerminals.delete(terminalId);
      this.clearAllForTerminal(terminalId);
    });

    monitor.activity$.pipe(takeUntilDestroyed(destroyRef)).subscribe((e) => {
      if (e.isBusy) {
        this.idleTerminals.delete(e.terminalId);
      } else {
        this.idleTerminals.add(e.terminalId);
        this.clearAllForTerminal(e.terminalId);
      }
    });
  }

  register(terminalId: string, registrationKey: string, spec: AnimationSpec): void {
    if (this.idleTerminals.has(terminalId)) return;
    const registrationId = `${registrationKey}-${terminalId}`;
    let ids = this.activeIds.get(terminalId);
    if (!ids) {
      ids = new Set();
      this.activeIds.set(terminalId, ids);
    }
    ids.add(registrationId);

    this.bus.publish({
      type: "BusyIndicatorRegister",
      payload: {
        registrationId,
        target: { kind: "terminal", id: terminalId },
        keyframes: spec.keyframes,
        priority: spec.priority,
      },
    });
  }

  unregister(terminalId: string, registrationKey: string): void {
    const registrationId = `${registrationKey}-${terminalId}`;
    this.activeIds.get(terminalId)?.delete(registrationId);
    this.bus.publish({
      type: "BusyIndicatorUnregister",
      payload: { registrationId },
    });
  }

  private clearAllForTerminal(terminalId: string): void {
    const ids = this.activeIds.get(terminalId);
    if (!ids) return;
    for (const registrationId of ids) {
      this.bus.publish({ type: "BusyIndicatorUnregister", payload: { registrationId } });
    }
    this.activeIds.delete(terminalId);
  }
}
