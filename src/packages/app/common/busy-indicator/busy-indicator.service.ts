import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { TabId, TerminalId } from "@cogno/core-api";
import { BehaviorSubject, distinctUntilChanged, map, Observable } from "rxjs";
import { AppBus } from "../../app-bus/app-bus";
import { GridListService } from "../../grid-list/+state/grid-list.service";
import { BusyIndicatorTarget } from "./+bus/events";

export type BusyIndicatorRegistration = {
  registrationId: string;
  target: BusyIndicatorTarget;
  keyframes: number[][][];
  priority: number;
};

@Injectable({ providedIn: "root" })
export class BusyIndicatorService {
  private readonly _map = new Map<string, BusyIndicatorRegistration>();
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
        this._map.set(payload.registrationId, payload);
        this.emit();
      });

    this.bus
      .onType$("BusyIndicatorUnregister")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        const registrationId = event.payload?.registrationId;
        if (!registrationId) return;
        this._map.delete(registrationId);
        this.emit();
      });

    this.bus
      .onType$("BusyIndicatorClearForTerminal")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        const terminalId = event.payload?.terminalId;
        if (!terminalId) return;
        let changed = false;
        for (const [id, reg] of this._map) {
          if (reg.target.kind === "terminal" && reg.target.id === terminalId) {
            this._map.delete(id);
            changed = true;
          }
        }
        if (changed) this.emit();
      });
  }

  private emit(): void {
    this._registrations$.next([...this._map.values()]);
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
