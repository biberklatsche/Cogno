import type { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { TerminalCommandHistoryStore } from "@cogno/core/session/model/command-history.store";
import { CommandRecorder } from "@cogno/core/session/recorder/command-recorder";
import { Renderer } from "@cogno/core/terminal/renderer";
import type { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { NotificationTargetResolverService } from "@cogno/core/workbench/grid-list/+state/notification-target-resolver.service";
import type { PaneLayoutLookup } from "@cogno/core/workbench/grid-list/+state/pane-layout-lookup";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { OsPlatform } from "@cogno/platform/os";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigServiceMock } from "../../../../__test__/mocks/config-service.mock";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { getActionKeybindingPortMock, getAppBus } from "../../../../__test__/test-factory";
import { SessionMenus } from "./session-menus";
import { SessionNotifications } from "./session-notifications";

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

describe("SessionNotifications", () => {
  let bus: AppBus;
  let host: SessionHost;
  let menus: SessionMenus;
  let maximizedTerminalId: string | undefined;
  let configService: ConfigServiceMock;

  function configure(config: Record<string, unknown>): void {
    configService.setConfig({
      font: { enable_ligatures: false },
      notification: {
        channel: {
          app: { available: true, enabled: false },
          os: { available: true, enabled: false },
        },
        source: {
          terminal: {
            osc9: { enabled: true },
            long_running_command: { enabled: true, minimum_duration_seconds: 10 },
          },
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

    host.initialize(terminalId, bashProfile);

    new SessionNotifications(
      bus,
      host,
      configService as unknown as ConfigService,
      {
        resolveForTerminal: vi.fn().mockReturnValue({ workspaceId: "w", tabId: "t", terminalId }),
      } as unknown as NotificationTargetResolverService,
    );

    maximizedTerminalId = undefined;
    menus = new SessionMenus(bus, host, getActionKeybindingPortMock(), {
      isMaximized: (id: string) => id === maximizedTerminalId,
    } as unknown as PaneLayoutLookup);

    host.start();
  });

  describe("facts to notifications", () => {
    it("publishes a notification when a long-running command has finished", () => {
      host.model.report({
        type: "commandCompleted",
        command: { command: "pnpm test", duration: 12_000, directory: "/workspace", returnCode: 0 },
      });

      expect(bus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "Notification",
          payload: expect.objectContaining({
            header: "Command finished after 12s",
            terminalId,
          }),
        }),
      );
    });

    it("stays quiet for a command shorter than the threshold", () => {
      vi.mocked(bus.publish).mockClear();

      host.model.report({
        type: "commandCompleted",
        command: { command: "pnpm test", duration: 9_000, directory: "/workspace", returnCode: 0 },
      });

      expect(bus.publish).not.toHaveBeenCalled();
    });

    it("turns an OSC 9 message into a Notification", () => {
      host.model.report({ type: "notificationRequested", message: "Build done" });

      expect(bus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "Notification",
          payload: expect.objectContaining({ body: "Build done", terminalId }),
        }),
      );
    });
  });

  describe("menu reads the workbench's maximized pane", () => {
    it("shows Minimize when the pane is maximized", () => {
      maximizedTerminalId = terminalId;

      const items = menus.buildContextMenu();
      expect(items.find((i) => i.label === "Minimize Pane")).toBeDefined();
      expect(items.find((i) => i.label === "Maximize Pane")).toBeUndefined();
    });
  });

  describe("menus", () => {
    it("builds the context menu", () => {
      const items = menus.buildContextMenu();

      expect(items.find((i) => i.label === "Paste")).toBeDefined();
      expect(items.find((i) => i.label === "Maximize Pane")).toBeDefined();
      expect(items.find((i) => i.label?.includes("Notifications"))).toBeUndefined();
    });

    it("fires each entry as a catalogue action aimed at its own terminal", () => {
      const publish = vi.spyOn(bus, "publish");
      const items = menus.buildContextMenu();

      for (const [label, actionName] of [
        ["Paste", "paste"],
        ["Split Right", "split_right"],
        ["Split Left", "split_left"],
        ["Split Down", "split_down"],
        ["Split Up", "split_up"],
        ["Maximize Pane", "maximize_pane"],
        ["Clear Buffer", "clear_buffer"],
        ["Close Terminal", "close_terminal"],
      ]) {
        items.find((item) => item.label === label)?.action?.();

        expect(publish).toHaveBeenLastCalledWith(
          expect.objectContaining({
            type: "ActionFired",
            payload: actionName,
            terminalId: host.terminalId,
          }),
        );
      }
    });

    it("sends the bell to the notifications", () => {
      menus.openNotifications();

      expect(bus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ActionFired", payload: "open_notification" }),
      );
    });

    it("offers the command menu for the command out of view", () => {
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
  });
});
