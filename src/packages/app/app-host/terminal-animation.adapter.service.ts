import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AnimationSpec, TerminalAnimationPort, TerminalMonitorPort } from "@cogno/core-api";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { AppBus } from "../app-bus/app-bus";
import { BusyIndicatorService } from "../common/busy-indicator/busy-indicator.service";

@Injectable({ providedIn: "root" })
export class TerminalAnimationAdapterService extends TerminalAnimationPort {
  constructor(
    private readonly bus: AppBus,
    private readonly busyIndicatorService: BusyIndicatorService,
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
        target: { kind: "terminal", id: terminalId },
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

  observe$(terminalId: string): Observable<ReadonlyArray<AnimationSpec>> {
    return this.busyIndicatorService
      .forTerminal$(terminalId)
      .pipe(map((regs) => regs.map((r) => ({ keyframes: r.keyframes, priority: r.priority }))));
  }

  private clearForTerminal(terminalId: string): void {
    this.bus.publish({
      type: "BusyIndicatorClearForTerminal",
      payload: { terminalId },
    });
  }
}
