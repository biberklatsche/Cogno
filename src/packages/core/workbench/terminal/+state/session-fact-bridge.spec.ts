import type { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import type { AutocompleteSuggestorSource } from "@cogno/core/session/autocomplete/autocomplete-suggestor.source";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { TerminalCommandHistoryStore } from "@cogno/core/session/model/command-history.store";
import { CommandRecorder } from "@cogno/core/session/recorder/command-recorder";
import { Renderer } from "@cogno/core/terminal/renderer";
import type { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { NotificationTargetResolverService } from "@cogno/core/workbench/grid-list/+state/notification-target-resolver.service";
import { TerminalActivityService } from "@cogno/core/workbench/terminal-activity/terminal-activity.service";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { OsPlatform } from "@cogno/platform/os";
import type { NotificationChannelsPort } from "@cogno/shared/ports";
import { DialogRef, type DialogService } from "@cogno/shared/ui";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigServiceMock } from "../../../../__test__/mocks/config-service.mock";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { getActionKeybindingPortMock, getAppBus } from "../../../../__test__/test-factory";
import { SessionFactBridge } from "./session-fact-bridge";
import { SessionMenus } from "./session-menus";

vi.mock("@cogno/core/terminal/renderer", () => {
  class RendererMock {
    open = vi.fn();
    register = vi.fn().mockReturnValue({ dispose: vi.fn() });
    dispose = vi.fn();
    setVisible = vi.fn();
    setOptions = vi.fn();
    restoreCursorColor = vi.fn();
    terminal = TerminalMockFactory.createTerminal();
    isWebglContextLost$ = new BehaviorSubject(false);
  }
  return { Renderer: vi.fn(RendererMock) };
});

vi.mock("@cogno/core/terminal/pty", () => {
  class PtyMock {
    dispose = vi.fn();
    write = vi.fn();
    spawn = vi.fn().mockResolvedValue(undefined);
    onExit = vi.fn().mockReturnValue({ dispose: vi.fn() });
    kill = vi.fn();
    faults$ = new Subject();
  }
  return { Pty: vi.fn(PtyMock) };
});

const osStub = { platform: () => "linux" } as unknown as OsPlatform;
const environmentStub = { isDevMode: () => false } as never;
const clipboardStub = { writeText: vi.fn(async () => undefined) } as unknown as ClipboardAccess;
const terminalId = "test-terminal-id";

const bashProfile: ShellProfile = {
  shell_type: "Bash",
  inject_cogno_cli: false,
  enable_shell_integration: false,
  load_user_rc: false,
};

function lastRenderer() {
  const results = vi.mocked(Renderer).mock.results;
  return results[results.length - 1].value;
}

describe("SessionFactBridge", () => {
  let bus: AppBus;
  let host: SessionHost;
  let bridge: SessionFactBridge;
  let menus: SessionMenus;
  let configService: ConfigServiceMock;
  let preloadForShellIntegration: ReturnType<typeof vi.fn>;
  let openDialog: ReturnType<typeof vi.fn>;
  let processInfoDialogRef: DialogRef<void>;

  function configure(config: Record<string, unknown>): void {
    configService.setConfig({
      font: { enable_ligatures: false },
      terminal: {
        notifications: { long_running_command: { enabled: true, minimum_duration_seconds: 10 } },
      },
      notification: {
        channel: {
          app: { available: true, enabled: false },
          os: { available: true, enabled: false },
        },
      },
      ...config,
    } as never);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    bus = getAppBus();
    vi.spyOn(bus, "publish");
    configService = new ConfigServiceMock();
    configure({});

    host = new SessionHost(
      osStub,
      environmentStub,
      clipboardStub,
      configService as unknown as ConfigService,
      {} as never,
      { openAtElement: vi.fn() },
      {} as never,
      new TerminalCommandHistoryStore(),
      {
        initialize: vi.fn(),
        onCwdChanged: vi.fn(),
        onCommandExecuted: vi.fn(),
      } as unknown as CommandRecorder,
    );

    preloadForShellIntegration = vi.fn();
    // The port as the bridge sees it: the two channels, filtered and defaulted
    // from config the way the real adapter (app/notification) does.
    const notificationChannelsPort: NotificationChannelsPort = {
      getAvailableChannels() {
        const channelConfig = configService.config.notification?.channel as
          | Readonly<Record<string, { readonly available?: boolean; readonly enabled?: boolean }>>
          | undefined;
        return [
          { id: "app", displayName: "App", sortOrder: 100 },
          { id: "os", displayName: "OS", sortOrder: 90 },
        ]
          .filter((channel) => channelConfig?.[channel.id]?.available ?? true)
          .sort((left, right) => right.sortOrder - left.sortOrder)
          .map((channel) => ({
            id: channel.id,
            displayName: channel.displayName,
            defaultEnabled: channelConfig?.[channel.id]?.enabled ?? false,
          }));
      },
    };
    bridge = new SessionFactBridge(
      bus,
      host,
      configService as unknown as ConfigService,
      new TerminalActivityService(),
      {
        resolveForTerminal: vi.fn().mockReturnValue({ workspaceId: "w", tabId: "t", terminalId }),
      } as unknown as NotificationTargetResolverService,
      notificationChannelsPort,
      { preloadForShellIntegration } as unknown as AutocompleteSuggestorSource,
      { triggerAutocomplete: vi.fn(async () => false), cycleTab: vi.fn(() => false) } as never,
      { triggerCommandHistory: vi.fn(async () => false), cycleTab: vi.fn(() => false) } as never,
      {} as never,
    );

    processInfoDialogRef = new DialogRef<void>(1, vi.fn());
    openDialog = vi.fn().mockReturnValue(processInfoDialogRef);
    menus = new SessionMenus(bus, host, bridge, getActionKeybindingPortMock(), osStub, {
      open: openDialog,
    } as unknown as DialogService);

    host.initialize(terminalId, bashProfile);
    bridge.start(terminalId, bashProfile);
  });

  describe("lifecycle", () => {
    it("preloads the autocomplete when the integration is on", () => {
      expect(preloadForShellIntegration).not.toHaveBeenCalled();

      const withIntegration = { ...bashProfile, enable_shell_integration: true };
      bridge.start("other-terminal", withIntegration);

      expect(preloadForShellIntegration).toHaveBeenCalledWith("Bash");
    });
  });

  describe("bus to host", () => {
    it("shows and hides the renderer with the visible set", () => {
      bus.publish({
        type: "VisibleTerminalsChanged",
        payload: { terminalIds: ["other"] },
      } as never);
      expect(lastRenderer().setVisible).toHaveBeenCalledWith(false);

      bus.publish({
        type: "VisibleTerminalsChanged",
        payload: { terminalIds: [terminalId] },
      } as never);
      expect(lastRenderer().setVisible).toHaveBeenCalledWith(true);
    });

    it("tells the host when its pane is maximized, and the menu shows Minimize", () => {
      bus.publish({ type: "PaneMaximizedChanged", payload: { terminalId } } as never);

      const items = menus.buildContextMenu();
      expect(items.find((i) => i.label === "Minimize")).toBeDefined();
      expect(items.find((i) => i.label === "Maximize")).toBeUndefined();
    });

    describe("focus", () => {
      beforeEach(() => {
        vi.useFakeTimers();
        host.start();
        host.attach(document.createElement("div"));
      });

      it("focuses on FocusTerminal for this id and says so", () => {
        bus.publish({ type: "FocusTerminal", payload: terminalId, path: ["app", "terminal"] });

        expect(host.isFocused).toBe(true);
        expect(bus.publish).toHaveBeenCalledWith(
          expect.objectContaining({ type: "TerminalFocused", payload: terminalId }),
        );
      });

      it("blurs on FocusTerminal for another id and says so", () => {
        bus.publish({ type: "FocusTerminal", payload: "other-id", path: ["app", "terminal"] });

        expect(host.isFocused).toBe(false);
        expect(bus.publish).toHaveBeenCalledWith(
          expect.objectContaining({ type: "TerminalBlurred", payload: terminalId }),
        );
      });

      it("blurs on BlurTerminal for this id", () => {
        bus.publish({ type: "FocusTerminal", payload: terminalId, path: ["app", "terminal"] });
        bus.publish({ type: "BlurTerminal", payload: terminalId, path: ["app", "terminal"] });

        expect(host.isFocused).toBe(false);
      });

      it("stops listening once disposed", () => {
        bridge.dispose();

        bus.publish({ type: "FocusTerminal", payload: terminalId, path: ["app", "terminal"] });

        expect(host.isFocused).toBe(false);
      });
    });
  });

  describe("facts to bus", () => {
    it("publishes a notification when a long-running command has finished", () => {
      configure({ notification: { channel: { app: { available: true, enabled: true } } } });

      host.model.report({
        type: "commandCompleted",
        command: { command: "pnpm test", duration: 12_000, directory: "/workspace", returnCode: 0 },
      });

      expect(bus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          path: ["notification"],
          type: "Notification",
          payload: expect.objectContaining({
            header: "Command finished after 12s",
            terminalId,
            channels: { app: true, os: false },
          }),
        }),
      );
    });

    it("stays quiet for a command shorter than the threshold", () => {
      configure({ notification: { channel: { app: { available: true, enabled: true } } } });
      vi.mocked(bus.publish).mockClear();

      host.model.report({
        type: "commandCompleted",
        command: { command: "pnpm test", duration: 9_000, directory: "/workspace", returnCode: 0 },
      });

      expect(bus.publish).not.toHaveBeenCalled();
    });

    it("turns an OSC 9 message into a Notification and marks the badge", () => {
      configure({ notification: { channel: { app: { available: true, enabled: true } } } });
      host.model.report({ type: "notificationRequested", message: "Build done" });

      expect(host.model.hasUnreadNotification).toBe(true);
      expect(bus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "Notification",
          payload: expect.objectContaining({ body: "Build done", terminalId }),
        }),
      );
    });
  });

  describe("menus", () => {
    it("builds the context menu", () => {
      const items = menus.buildContextMenu();

      expect(items.find((i) => i.label === "Paste")).toBeDefined();
      expect(items.find((i) => i.label === "Maximize")).toBeDefined();
      expect(items.find((i) => i.label === "Process Info")).toBeDefined();
      expect(items.find((i) => i.label?.includes("Notifications"))).toBeUndefined();
    });

    it("only shows available notification channels in the header menu", () => {
      configure({
        notification: {
          channel: {
            app: { available: true, enabled: false },
            os: { available: false, enabled: false },
          },
        },
      });

      const items = menus.buildHeaderMenu();

      expect(items[0]).toEqual(expect.objectContaining({ header: true, label: "Notify me when…" }));
      const toggle = items.find((i) => i.label === "Command finished (ran ≥ 10 s)");
      expect(toggle?.toggle).toBe(true);
      expect(toggle?.toggled).toBe(true);
      expect(items.find((i) => i.label === "App")?.toggled).toBe(false);
      expect(items.find((i) => i.label === "OS")).toBeUndefined();
    });

    it("toggles long-running command notifications from the header menu", () => {
      configure({ notification: { channel: { app: { available: true, enabled: true } } } });

      const toggle = menus
        .buildHeaderMenu()
        .find((i) => i.label === "Command finished (ran ≥ 10 s)");
      expect(toggle?.toggled).toBe(true);

      toggle?.action?.(toggle);

      expect(toggle?.toggled).toBe(false);
    });

    it("keeps the command menu out of the header menu and offers it for the command out of view", () => {
      host.model.updateCommand({ id: "1" });
      host.model.commands[0].set("command", "cat bible.txt");
      host.model.updateCommands([
        Object.assign(host.model.commands[0], { isFirstCommandOutOfViewport: true }),
      ]);
      vi.mocked(lastRenderer().terminal.buffer.active.getLine).mockImplementation(
        (line: number) => {
          if (line === 0) return TerminalMockFactory.createLine("^^#1");
          if (line === 1) return TerminalMockFactory.createLine("first output line");
          if (line === 2) return TerminalMockFactory.createLine("^^#2");
          return null;
        },
      );
      lastRenderer().terminal.buffer.active.length = 3;

      expect(menus.buildHeaderMenu().find((i) => i.label === "Copy Command")).toBeUndefined();

      const items = menus.buildHeaderCommandMenu();
      expect(items.map((i) => i.label)).toEqual(
        expect.arrayContaining([
          "Copy Command",
          "Copy Output",
          "Scroll to Top",
          "Scroll to Bottom",
          "Filter Block",
        ]),
      );
      items.find((i) => i.label === "Scroll to Top")?.action?.();
      expect(lastRenderer().terminal.scrollToLine).toHaveBeenCalledWith(0);
    });

    it("closes the process info dialog when the menus are disposed", () => {
      const closeSpy = vi.spyOn(processInfoDialogRef, "close");
      menus
        .buildContextMenu()
        .find((i) => i.label === "Process Info")
        ?.action?.();
      expect(openDialog).toHaveBeenCalledTimes(1);

      menus.dispose();

      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
