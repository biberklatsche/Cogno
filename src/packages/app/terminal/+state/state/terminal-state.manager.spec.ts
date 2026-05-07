import { PathFactory } from "@cogno/app/app-host/path.factory";
import { featureShellPathAdapterDefinitions } from "@cogno/features";
import type { Observable } from "rxjs";
import { beforeEach, describe, expect, it } from "vitest";
import { getDestroyRef } from "../../../../__test__/test-factory";
import { AppBus } from "../../../app-bus/app-bus";
import type { Config, ShellType } from "../../../config/+models/config";
import type { PromptSegment } from "../../../config/+models/prompt-config";
import type { ShellProfile } from "../../../config/+models/shell-config";
import { ConfigService, ShellProfileEntry } from "../../../config/+state/config.service";
import { TerminalStateManager } from "./terminal-state.manager";

class ConfigServiceMockForNotificationBadge extends ConfigService {
  override getOrderedShellProfiles(_limit?: number): ShellProfileEntry[] {
    throw new Error("Method not implemented.");
  }
  override getShellProfileByShortcutIndex(_index: number): ShellProfileEntry | undefined {
    throw new Error("Method not implemented.");
  }
  constructor(private readonly notificationBadgeEnabledState: { value: boolean }) {
    super();
  }

  get config(): Config {
    return {
      notification: {
        highlight_terminal_on_activity: this.notificationBadgeEnabledState.value,
      },
    } as Config;
  }

  get config$(): Observable<Config> {
    throw new Error("Not used in this test.");
  }

  getShellProfileOrDefault(_name?: string): ShellProfile {
    throw new Error("Not used in this test.");
  }

  getPromptSegments(): PromptSegment[] {
    return [];
  }
}

describe("TerminalStateManager", () => {
  beforeEach(() => {
    PathFactory.setDefinitions([...featureShellPathAdapterDefinitions]);
  });

  it("should keep only the focused terminal state manager focused", () => {
    const bus = new AppBus();
    const firstTerminalStateManager = new TerminalStateManager(
      bus,
      undefined,
      undefined,
      getDestroyRef(),
    );
    const secondTerminalStateManager = new TerminalStateManager(
      bus,
      undefined,
      undefined,
      getDestroyRef(),
    );

    firstTerminalStateManager.initialize("terminal-1", "Bash" as ShellType);
    secondTerminalStateManager.initialize("terminal-2", "Bash" as ShellType);

    bus.publish({ type: "FocusTerminal", payload: "terminal-1", path: ["app", "terminal"] });
    expect(firstTerminalStateManager.isFocused).toBe(true);
    expect(secondTerminalStateManager.isFocused).toBe(false);

    bus.publish({ type: "FocusTerminal", payload: "terminal-2", path: ["app", "terminal"] });
    expect(firstTerminalStateManager.isFocused).toBe(false);
    expect(secondTerminalStateManager.isFocused).toBe(true);
  });

  it("should set and clear unread notification state", () => {
    const bus = new AppBus();
    const terminalStateManager = new TerminalStateManager(
      bus,
      undefined,
      undefined,
      getDestroyRef(),
    );
    terminalStateManager.initialize("terminal-1", "Bash" as ShellType);

    expect(terminalStateManager.hasUnreadNotification).toBe(false);
    terminalStateManager.markUnreadNotification();
    expect(terminalStateManager.hasUnreadNotification).toBe(true);
    terminalStateManager.clearUnreadNotification();
    expect(terminalStateManager.hasUnreadNotification).toBe(false);
  });

  it("should not mark unread notification when notification.highlight_terminal_on_activity is false", () => {
    const bus = new AppBus();
    const notificationBadgeEnabledState = { value: false };
    const configService = new ConfigServiceMockForNotificationBadge(notificationBadgeEnabledState);
    const terminalStateManager = new TerminalStateManager(
      bus,
      undefined,
      undefined,
      getDestroyRef(),
      configService,
    );
    terminalStateManager.initialize("terminal-1", "Bash" as ShellType);

    terminalStateManager.markUnreadNotification();

    expect(terminalStateManager.hasUnreadNotification).toBe(false);
  });

  it("should clear unread notification on ConfigLoaded when highlight_terminal_on_activity is switched to false", () => {
    const bus = new AppBus();
    const notificationBadgeEnabledState = { value: true };
    const configService = new ConfigServiceMockForNotificationBadge(notificationBadgeEnabledState);
    const terminalStateManager = new TerminalStateManager(
      bus,
      undefined,
      undefined,
      getDestroyRef(),
      configService,
    );
    terminalStateManager.initialize("terminal-1", "Bash" as ShellType);

    terminalStateManager.markUnreadNotification();
    expect(terminalStateManager.hasUnreadNotification).toBe(true);

    notificationBadgeEnabledState.value = false;
    bus.publish({ type: "ConfigLoaded", path: ["app", "settings"] });

    expect(terminalStateManager.hasUnreadNotification).toBe(false);
  });

  it("should store bounded terminal progress state", () => {
    const bus = new AppBus();
    const terminalStateManager = new TerminalStateManager(
      bus,
      undefined,
      undefined,
      getDestroyRef(),
    );
    terminalStateManager.initialize("terminal-1", "Bash" as ShellType);

    terminalStateManager.setProgress("warning", 132);

    expect(terminalStateManager.state.progress).toEqual({
      state: "warning",
      value: 100,
    });
  });

  it("should clear terminal progress when hidden state is set", () => {
    const bus = new AppBus();
    const terminalStateManager = new TerminalStateManager(
      bus,
      undefined,
      undefined,
      getDestroyRef(),
    );
    terminalStateManager.initialize("terminal-1", "Bash" as ShellType);

    terminalStateManager.setProgress("default", 55);
    terminalStateManager.setProgress("hidden", 55);

    expect(terminalStateManager.state.progress).toEqual({
      state: "hidden",
      value: 0,
    });
  });
});
