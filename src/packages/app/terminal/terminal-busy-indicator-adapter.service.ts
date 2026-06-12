import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { TerminalId } from "@cogno/core-api";
import { BAR_COUNT, heightFrameToGrid, MAX_HEIGHT, MIN_HEIGHT } from "@cogno/core-ui";
import { Subscription } from "rxjs";
import { AppBus } from "../app-bus/app-bus";
import { TerminalActivityService } from "../common/terminal-activity/terminal-activity.service";

const ACTIVE_FRAME_COUNT = 6;
const IDLE_FRAME_COUNT = 20;
const IDLE_WAVE_MIN = 1;
const IDLE_WAVE_MAX = 3;
const IDLE_WAVE_DELAY_MS = 2000;

const PRIORITY_TERMINAL_ACTIVE = 2;
const PRIORITY_TERMINAL_IDLE = 1;

function generateActiveKeyframes(): number[][][] {
  return Array.from({ length: ACTIVE_FRAME_COUNT }, (_, fi) => {
    const heights = Array.from({ length: BAR_COUNT }, (_, bi) => {
      const phase = (bi / BAR_COUNT) * Math.PI * 2;
      const t = (fi / ACTIVE_FRAME_COUNT) * Math.PI * 2;
      return MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * (0.5 + 0.5 * Math.sin(t + phase));
    });
    return heightFrameToGrid(heights);
  });
}

function generateIdleKeyframes(): number[][][] {
  return Array.from({ length: IDLE_FRAME_COUNT }, (_, fi) => {
    const heights = Array.from({ length: BAR_COUNT }, (_, bi) => {
      const phase = (bi / BAR_COUNT) * Math.PI * 2;
      const t = (fi / IDLE_FRAME_COUNT) * Math.PI * 2;
      return IDLE_WAVE_MIN + (IDLE_WAVE_MAX - IDLE_WAVE_MIN) * (0.5 + 0.5 * Math.sin(t + phase));
    });
    return heightFrameToGrid(heights);
  });
}

const TERMINAL_BUSY_FRAMES = generateActiveKeyframes();
const TERMINAL_IDLE_FRAMES = generateIdleKeyframes();

@Injectable({ providedIn: "root" })
export class TerminalBusyIndicatorAdapterService {
  private readonly activitySubs = new Map<TerminalId, Subscription>();
  private readonly idleTimers = new Map<TerminalId, ReturnType<typeof setTimeout>>();
  private readonly waveStates = new Map<TerminalId, "active" | "idle">();

  constructor(
    private readonly bus: AppBus,
    private readonly terminalActivity: TerminalActivityService,
    destroyRef: DestroyRef,
  ) {
    this.bus
      .onType$("TerminalBusyChanged", { path: ["app", "terminal"] })
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        const payload = event.payload;
        if (!payload) return;
        if (payload.isBusy) {
          this.registerActive(payload.terminalId);
          this.waveStates.set(payload.terminalId, "active");
          this.startActivityTracking(payload.terminalId);
        } else {
          this.stopActivityTracking(payload.terminalId);
          this.unregisterBoth(payload.terminalId);
        }
      });

    this.bus
      .onType$("TerminalRemoved", { path: ["app", "terminal"] })
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
        target: { kind: "terminal", id: terminalId },
        keyframes: TERMINAL_BUSY_FRAMES,
        priority: PRIORITY_TERMINAL_ACTIVE,
      },
    });
  }

  private registerIdle(terminalId: TerminalId): void {
    this.bus.publish({
      type: "BusyIndicatorRegister",
      payload: {
        registrationId: `terminal-busy-idle-${terminalId}`,
        target: { kind: "terminal", id: terminalId },
        keyframes: TERMINAL_IDLE_FRAMES,
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
