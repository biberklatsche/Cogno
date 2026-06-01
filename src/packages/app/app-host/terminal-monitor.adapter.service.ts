import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { TerminalActivityEvent, TerminalMonitorPort } from "@cogno/core-api";
import { Observable, Subject } from "rxjs";
import { AppBus } from "../app-bus/app-bus";

@Injectable({ providedIn: "root" })
export class TerminalMonitorAdapterService extends TerminalMonitorPort {
  private readonly _activity$ = new Subject<TerminalActivityEvent>();
  private readonly _terminated$ = new Subject<string>();

  readonly activity$: Observable<TerminalActivityEvent> = this._activity$.asObservable();
  readonly terminated$: Observable<string> = this._terminated$.asObservable();

  constructor(bus: AppBus, destroyRef: DestroyRef) {
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
  }
}
