import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AnimationSpec, TerminalAnimationPort, TerminalMonitorPort } from "@cogno/core-api";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { AppBus } from "../app-bus/app-bus";
import { BusyIndicatorService } from "../common/busy-indicator/busy-indicator.service";

@Injectable({ providedIn: "root" })
export class TerminalAnimationAdapterService extends TerminalAnimationPort {
  private readonly activeIds = new Map<string, Set<string>>();

  constructor(
    private readonly bus: AppBus,
    private readonly busyIndicatorService: BusyIndicatorService,
    monitor: TerminalMonitorPort,
    destroyRef: DestroyRef,
  ) {
    super();

    monitor.activity$.pipe(takeUntilDestroyed(destroyRef)).subscribe((e) => {
      if (!e.isBusy) this.clearAllForTerminal(e.terminalId);
    });

    monitor.terminated$.pipe(takeUntilDestroyed(destroyRef)).subscribe((terminalId) => {
      this.clearAllForTerminal(terminalId);
    });
  }

  register(terminalId: string, registrationKey: string, spec: AnimationSpec): void {
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
        slot: registrationKey,
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

  observe$(terminalId: string): Observable<ReadonlyArray<AnimationSpec>> {
    return this.busyIndicatorService
      .forTerminal$(terminalId)
      .pipe(map((regs) => regs.map((r) => ({ keyframes: r.keyframes, priority: r.priority }))));
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
