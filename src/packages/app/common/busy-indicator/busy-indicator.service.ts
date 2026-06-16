import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { TabId, TerminalId } from "@cogno/core-api";
import { BehaviorSubject, distinctUntilChanged, map, Observable } from "rxjs";
import { AppBus } from "../../app-bus/app-bus";
import { GridListService } from "../../grid-list/+state/grid-list.service";
import { BusyIndicatorTarget } from "./+bus/events";

export type BusyIndicatorRegistration = {
  registrationId: string;
  slot?: string;
  target: BusyIndicatorTarget;
  keyframes: number[][][];
  priority: number;
};

@Injectable({ providedIn: "root" })
export class BusyIndicatorService {
  private readonly _map = new Map<string, BusyIndicatorRegistration>();
  /** Maps "${slot}:${target.kind}:${target.id}" → registrationId for slot-based eviction. */
  private readonly _slotIndex = new Map<string, string>();
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
        if (payload.slot) {
          const slotKey = `${payload.slot}:${payload.target.kind}:${payload.target.id}`;
          const prevId = this._slotIndex.get(slotKey);
          if (prevId && prevId !== payload.registrationId) {
            this._map.delete(prevId);
          }
          this._slotIndex.set(slotKey, payload.registrationId);
        }
        this._map.set(payload.registrationId, payload);
        this.emit();
      });

    this.bus
      .onType$("BusyIndicatorUnregister")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        const registrationId = event.payload?.registrationId;
        if (!registrationId) return;
        const reg = this._map.get(registrationId);
        if (reg?.slot) {
          const slotKey = `${reg.slot}:${reg.target.kind}:${reg.target.id}`;
          if (this._slotIndex.get(slotKey) === registrationId) {
            this._slotIndex.delete(slotKey);
          }
        }
        this._map.delete(registrationId);
        this.emit();
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
