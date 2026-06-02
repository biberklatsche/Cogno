import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BAR_COUNT, heightFrameToGrid, MAX_HEIGHT, MIN_HEIGHT } from "@cogno/core-ui";
import { AppBus } from "../app-bus/app-bus";

const FRAME_COUNT = 6;

function generateSineKeyframes(): number[][][] {
  return Array.from({ length: FRAME_COUNT }, (_, fi) => {
    const heights = Array.from({ length: BAR_COUNT }, (_, bi) => {
      const phase = (bi / BAR_COUNT) * Math.PI * 2;
      const t = (fi / FRAME_COUNT) * Math.PI * 2;
      return MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * (0.5 + 0.5 * Math.sin(t + phase));
    });
    return heightFrameToGrid(heights);
  });
}

const TERMINAL_BUSY_FRAMES = generateSineKeyframes();

@Injectable({ providedIn: "root" })
export class TerminalBusyIndicatorAdapterService {
  constructor(
    private readonly bus: AppBus,
    destroyRef: DestroyRef,
  ) {
    this.bus
      .onType$("TerminalBusyChanged", { path: ["app", "terminal"] })
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        const payload = event.payload;
        if (!payload) return;
        if (payload.isBusy) {
          this.bus.publish({
            type: "BusyIndicatorRegister",
            payload: {
              registrationId: `terminal-busy-${payload.terminalId}`,
              target: { kind: "terminal", id: payload.terminalId },
              keyframes: TERMINAL_BUSY_FRAMES,
              priority: 1,
            },
          });
        } else {
          this.bus.publish({
            type: "BusyIndicatorUnregister",
            payload: { registrationId: `terminal-busy-${payload.terminalId}` },
          });
        }
      });

    this.bus
      .onType$("TerminalRemoved", { path: ["app", "terminal"] })
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        if (!event.payload) return;
        this.bus.publish({
          type: "BusyIndicatorUnregister",
          payload: { registrationId: `terminal-busy-${event.payload}` },
        });
      });
  }
}
