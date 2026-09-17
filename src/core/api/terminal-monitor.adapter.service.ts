import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { TerminalId } from "@cogno/shared/domain";
import { filter, map, Observable, Subject } from "rxjs";
import {
  TerminalActivityEvent,
  TerminalCwdChangeEvent,
  TerminalMonitorPort,
} from "./terminal-monitor-port";

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
    this.sessionRegistry.facts$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(({ terminalId, fact }) => {
        if (fact.type !== "busyChanged") return;
        this._activity$.next({ terminalId, isBusy: fact.isBusy });
      });

    bus
      .on$("TerminalRemoved")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        if (event.payload) this._terminated$.next(event.payload);
      });

    this.cwdChanges$ = this.sessionRegistry.facts$.pipe(
      map(({ terminalId, fact }) =>
        fact.type === "cwdReported" ? { terminalId, cwd: fact.cwd } : undefined,
      ),
      filter((change): change is TerminalCwdChangeEvent => change !== undefined),
    );
  }

  isTerminalActive(terminalId: TerminalId): boolean {
    return this.sessionRegistry.has(terminalId);
  }

  getCwd(terminalId: TerminalId): string | undefined {
    return this.sessionRegistry.get(terminalId)?.host.state.cwd || undefined;
  }
}
