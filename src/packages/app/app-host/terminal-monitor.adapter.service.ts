import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import {
  TerminalActivityEvent,
  TerminalCwdChangeEvent,
  TerminalMonitorPort,
} from "@cogno/features/coding-agent/ports";
import { TerminalId } from "@cogno/shared/ports";
import { filter, map, Observable, Subject } from "rxjs";

@Injectable({ providedIn: "root" })
export class TerminalMonitorAdapterService extends TerminalMonitorPort {
  private readonly _activity$ = new Subject<TerminalActivityEvent>();
  private readonly _terminated$ = new Subject<TerminalId>();

  readonly activity$: Observable<TerminalActivityEvent> = this._activity$.asObservable();
  readonly terminated$: Observable<TerminalId> = this._terminated$.asObservable();
  readonly cwdChanges$: Observable<TerminalCwdChangeEvent>;

  constructor(
    bus: AppBus,
    destroyRef: DestroyRef,
    private readonly sessionRegistry: TerminalSessionRegistry,
  ) {
    super();
    bus
      .onType$("TerminalBusyChanged", { path: ["app", "terminal"] })
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        if (!event.payload) return;
        this._activity$.next({
          terminalId: event.payload.terminalId,
          isBusy: event.payload.isBusy,
        });
      });

    bus
      .onType$("TerminalRemoved", { path: ["app", "terminal"] })
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        if (event.payload) this._terminated$.next(event.payload);
      });

    this.cwdChanges$ = bus.onType$("TerminalCwdChanged", { path: ["app", "terminal"] }).pipe(
      map((event) => event.payload),
      filter((payload): payload is TerminalCwdChangeEvent => !!payload),
    );
  }

  isTerminalActive(terminalId: TerminalId): boolean {
    return this.sessionRegistry.has(terminalId);
  }

  getCwd(terminalId: TerminalId): string | undefined {
    return this.sessionRegistry.get(terminalId)?.host.state.cwd || undefined;
  }
}
