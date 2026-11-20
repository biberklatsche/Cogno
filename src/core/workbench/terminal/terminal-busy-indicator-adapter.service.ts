import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { TerminalActivityService } from "@cogno/core/workbench/terminal-activity/terminal-activity.service";
import { TerminalId } from "@cogno/shared/domain";
import type { StatusIndicator } from "@cogno/shared/ui";
import { Subscription } from "rxjs";

const IDLE_WAVE_DELAY_MS = 2000;

const PRIORITY_TERMINAL_ACTIVE = 2;
const PRIORITY_TERMINAL_IDLE = 1;

/** Output is flowing. */
const TERMINAL_ACTIVE: StatusIndicator = { motif: "equalizer", mood: "busy" };
/** Still running, but no output for IDLE_WAVE_DELAY_MS. */
const TERMINAL_IDLE: StatusIndicator = { motif: "equalizer", mood: "calm" };

@Injectable({ providedIn: "root" })
export class TerminalBusyIndicatorAdapterService {
  private readonly activitySubs = new Map<TerminalId, Subscription>();
  private readonly idleTimers = new Map<TerminalId, ReturnType<typeof setTimeout>>();
  private readonly waveStates = new Map<TerminalId, "active" | "idle">();

  constructor(
    private readonly bus: AppBus,
    private readonly terminalActivity: TerminalActivityService,
    sessionRegistry: TerminalSessionRegistry,
    destroyRef: DestroyRef,
  ) {
    sessionRegistry.facts$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(({ terminalId, fact }) => {
        if (fact.type !== "busyChanged") return;
        if (fact.isBusy) {
          this.registerActive(terminalId);
          this.waveStates.set(terminalId, "active");
          this.startActivityTracking(terminalId);
        } else {
          this.stopActivityTracking(terminalId);
          this.unregisterBoth(terminalId);
        }
      });

    this.bus
      .on$("TerminalRemoved")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        if (!event.payload) return;
        this.stopActivityTracking(event.payload);
        this.unregisterBoth(event.payload);
      });
  }

  private registerActive(terminalId: TerminalId): void {
    this.bus.publish({
      type: "BusyIndicatorRegister",
      payload: {
        registrationId: `terminal-busy-active-${terminalId}`,
        terminalId,
        indicator: TERMINAL_ACTIVE,
        priority: PRIORITY_TERMINAL_ACTIVE,
      },
    });
  }

  private registerIdle(terminalId: TerminalId): void {
    this.bus.publish({
      type: "BusyIndicatorRegister",
      payload: {
        registrationId: `terminal-busy-idle-${terminalId}`,
        terminalId,
        indicator: TERMINAL_IDLE,
        priority: PRIORITY_TERMINAL_IDLE,
      },
    });
  }

  private unregisterBoth(terminalId: TerminalId): void {
    this.bus.publish({
      type: "BusyIndicatorUnregister",
      payload: { registrationId: `terminal-busy-active-${terminalId}` },
    });
    this.bus.publish({
      type: "BusyIndicatorUnregister",
      payload: { registrationId: `terminal-busy-idle-${terminalId}` },
    });
  }

  private startActivityTracking(terminalId: TerminalId): void {
    this.stopActivityTracking(terminalId);
    this.scheduleIdleTransition(terminalId);
    const sub = this.terminalActivity.activity$(terminalId).subscribe(() => {
      this.scheduleIdleTransition(terminalId);
      if (this.waveStates.get(terminalId) !== "active") {
        this.bus.publish({
          type: "BusyIndicatorUnregister",
          payload: { registrationId: `terminal-busy-idle-${terminalId}` },
        });
        this.registerActive(terminalId);
        this.waveStates.set(terminalId, "active");
      }
    });
    this.activitySubs.set(terminalId, sub);
  }

  private stopActivityTracking(terminalId: TerminalId): void {
    this.activitySubs.get(terminalId)?.unsubscribe();
    this.activitySubs.delete(terminalId);
    clearTimeout(this.idleTimers.get(terminalId));
    this.idleTimers.delete(terminalId);
    this.waveStates.delete(terminalId);
  }

  private scheduleIdleTransition(terminalId: TerminalId): void {
    clearTimeout(this.idleTimers.get(terminalId));
    const timer = setTimeout(() => {
      this.bus.publish({
        type: "BusyIndicatorUnregister",
        payload: { registrationId: `terminal-busy-active-${terminalId}` },
      });
      this.registerIdle(terminalId);
      this.waveStates.set(terminalId, "idle");
    }, IDLE_WAVE_DELAY_MS);
    this.idleTimers.set(terminalId, timer);
  }
}
