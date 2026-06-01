import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { TabId } from "@cogno/core-api";
import { BehaviorSubject, distinctUntilChanged, map, Observable } from "rxjs";
import { AppBus } from "../../app-bus/app-bus";
import { TerminalId } from "../../grid-list/+model/model";
import { GridListService } from "../../grid-list/+state/grid-list.service";
import { BusyIndicatorTarget } from "./+bus/events";

export type BusyIndicatorRegistration = {
  registrationId: string;
  target: BusyIndicatorTarget;
  keyframes: number[][];
  priority: number;
};

@Injectable({ providedIn: "root" })
export class BusyIndicatorService {
  private readonly _registrations$ = new BehaviorSubject<BusyIndicatorRegistration[]>([]);

  constructor(
    private readonly bus: AppBus,
    private readonly gridListService: GridListService,
    destroyRef: DestroyRef,
  ) {
    this.bus
      .onType$("BusyIndicatorRegister")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        const payload = event.payload;
        if (!payload) return;
        const existing = this.getRegistrationsRetainedFor(payload.registrationId, payload.target);
        this._registrations$.next([
          ...existing,
          {
            registrationId: payload.registrationId,
            target: payload.target,
            keyframes: payload.keyframes,
            priority: payload.priority,
          },
        ]);
      });

    this.bus
      .onType$("BusyIndicatorUnregister")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        const registrationId = event.payload?.registrationId;
        if (!registrationId) return;
        this._registrations$.next(
          this._registrations$.value.filter((r) => r.registrationId !== registrationId),
        );
      });
  }

  private getRegistrationsRetainedFor(
    registrationId: string,
    target: BusyIndicatorTarget,
  ): BusyIndicatorRegistration[] {
    return this._registrations$.value.filter((registration) => {
      if (registration.registrationId === registrationId) return false;
      if (target.kind !== "terminal") return true;
      return registration.target.kind !== "terminal" || registration.target.id !== target.id;
    });
  }

  forTerminal$(terminalId: TerminalId): Observable<BusyIndicatorRegistration[]> {
    return this._registrations$.pipe(
      map((regs) => regs.filter((r) => r.target.kind === "terminal" && r.target.id === terminalId)),
      distinctUntilChanged(sameRegistrations),
    );
  }

  forTab$(tabId: TabId): Observable<BusyIndicatorRegistration[]> {
    return this._registrations$.pipe(
      map((regs) =>
        regs.filter((r) => {
          if (r.target.kind === "tab") return r.target.id === tabId;
          return this.gridListService.findTabIdByTerminalId(r.target.id) === tabId;
        }),
      ),
      distinctUntilChanged(sameRegistrations),
    );
  }

  hasAnimation$(tabId: TabId): Observable<boolean> {
    return this.forTab$(tabId).pipe(
      map((regs) => regs.length > 0),
      distinctUntilChanged(),
    );
  }
}

function sameRegistrations(
  a: BusyIndicatorRegistration[],
  b: BusyIndicatorRegistration[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (r, i) =>
      r.registrationId === b[i].registrationId &&
      r.target.kind === b[i].target.kind &&
      r.target.id === b[i].target.id &&
      r.priority === b[i].priority &&
      r.keyframes === b[i].keyframes,
  );
}
