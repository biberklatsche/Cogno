import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { TabId } from "@cogno/core/workbench/grid-layout";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { TerminalId } from "@cogno/shared/domain";
import { BehaviorSubject, combineLatest, distinctUntilChanged, map, Observable } from "rxjs";

export type BusyIndicatorRegistration = {
  registrationId: string;
  terminalId: string;
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
      .on$("BusyIndicatorRegister")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        const payload = event.payload;
        if (!payload) return;
        this._map.set(payload.registrationId, payload);
        this.emit();
      });

    this.bus
      .on$("BusyIndicatorUnregister")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        const registrationId = event.payload?.registrationId;
        if (!registrationId) return;
        this._map.delete(registrationId);
        this.emit();
      });

    this.bus
      .on$("BusyIndicatorClearForTerminal")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        const terminalId = event.payload?.terminalId;
        if (!terminalId) return;
        let changed = false;
        for (const [id, reg] of this._map) {
          if (reg.terminalId === terminalId) {
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
      map((regs) => regs.filter((r) => r.terminalId === terminalId)),
      distinctUntilChanged(sameRegistrations),
    );
  }

  /** Re-evaluated on every layout change too: a pane can move to another tab. */
  forTab$(tabId: TabId): Observable<BusyIndicatorRegistration[]> {
    return combineLatest([this._registrations$, this.gridListService.grids$]).pipe(
      map(([regs]) =>
        regs.filter((r) => this.gridListService.findTabIdByTerminalId(r.terminalId) === tabId),
      ),
      distinctUntilChanged(sameRegistrations),
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
      r.terminalId === b[i].terminalId &&
      r.priority === b[i].priority &&
      r.keyframes === b[i].keyframes,
  );
}
