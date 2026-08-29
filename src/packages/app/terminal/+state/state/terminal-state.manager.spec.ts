import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { OsPlatform } from "@cogno/platform/os";
import { describe, expect, it } from "vitest";
import { getDestroyRef } from "../../../../__test__/test-factory";
import { AppBus } from "../../../app-bus/app-bus";
import { TerminalStateManager } from "./terminal-state.manager";

/** Only `config.terminal.notifications.unread_badge` is read here. */
function configWithBadge(badge: { value: boolean }): ConfigService {
  return {
    get config() {
      return { terminal: { notifications: { unread_badge: badge.value } } };
    },
  } as unknown as ConfigService;
}

const osStub = { platform: () => "linux" } as unknown as OsPlatform;

describe("TerminalStateManager (bus glue)", () => {
  it("clears the unread notification on ConfigLoaded when unread_badge is switched off", () => {
    const bus = new AppBus();
    const badge = { value: true };
    const stateManager = new TerminalStateManager(
      osStub,
      bus,
      undefined,
      undefined,
      getDestroyRef(),
      configWithBadge(badge),
    );
    stateManager.initialize("terminal-1", "Bash");

    stateManager.markUnreadNotification();
    expect(stateManager.hasUnreadNotification).toBe(true);

    badge.value = false;
    bus.publish({ type: "ConfigLoaded", path: ["app", "settings"] });

    expect(stateManager.hasUnreadNotification).toBe(false);
  });

  it("publishes busy and cwd facts as the old bus messages", () => {
    const bus = new AppBus();
    const published: unknown[] = [];
    bus
      .onType$("TerminalBusyChanged", { path: ["app", "terminal"], phase: "target" })
      .subscribe((e) => published.push(e.payload));
    bus
      .onType$("TerminalCwdChanged", { path: ["app", "terminal", "terminal-1"], phase: "target" })
      .subscribe((e) => published.push(e.payload));
    const stateManager = new TerminalStateManager(
      osStub,
      bus,
      undefined,
      undefined,
      getDestroyRef(),
    );
    stateManager.initialize("terminal-1", "Bash");

    stateManager.startCommand();
    stateManager.updateCwd("/tmp");

    expect(published).toEqual([
      { terminalId: "terminal-1", isBusy: true },
      { cwd: "/tmp", terminalId: "terminal-1" },
    ]);
  });
});
