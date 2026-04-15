import type { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import type { NotificationChannelContract, ShellDefinitionContract } from "@cogno/core-api";
import { PathFactory } from "@cogno/core-host";
import { featureShellPathAdapterDefinitions } from "@cogno/features";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigServiceMock } from "../../../__test__/mocks/config-service.mock";
import { TerminalMockFactory } from "../../../__test__/mocks/terminal-mock.factory";
import { getAppBus, getStateManager } from "../../../__test__/test-factory";
import type { AppBus } from "../../app-bus/app-bus";
import type { TerminalAutocompleteFeatureSuggestorService } from "../../app-host/terminal-autocomplete-feature-suggestor.service";
import type { DialogService } from "../../common/dialog";
import { DialogRef } from "../../common/dialog/dialog-ref";
import type { ShellProfile } from "../../config/+models/shell-config";
import type { ContextMenuOverlayService } from "../../menu/context-menu-overlay/context-menu-overlay.service";
import { Renderer } from "./renderer/renderer";
import { TerminalSession } from "./terminal.session";

type TerminalAutocompleteSuggestorPort = Pick<
  TerminalAutocompleteFeatureSuggestorService,
  "preloadForShellIntegration"
>;
type WiringPort = Pick<AppWiringService, "getShellDefinitions" | "getNotificationChannels">;
type DialogPort = Pick<DialogService, "open">;
type ContextMenuOverlayPort = Pick<ContextMenuOverlayService, "openContextForElement">;

vi.mock("./renderer/renderer", () => {
  return {
    Renderer: vi.fn().mockImplementation(() => ({
      open: vi.fn(),
      register: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      dispose: vi.fn(),
      terminal: TerminalMockFactory.createTerminal(),
    })),
  };
});

vi.mock("./pty/pty", () => {
  return {
    Pty: vi.fn().mockImplementation(() => ({
      dispose: vi.fn(),
      write: vi.fn(),
      spawn: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe("TerminalSession", () => {
  let session: TerminalSession;
  let configService: ConfigServiceMock;
  let appBus: AppBus;
  let shellProfile: ShellProfile;
  let featureSuggestorService: TerminalAutocompleteSuggestorPort;
  let preloadForShellIntegrationMock: ReturnType<typeof vi.fn>;
  let processInfoDialogRef: DialogRef<void>;
  let closeProcessInfoDialogSpy: ReturnType<typeof vi.spyOn>;
  let openDialogMock: ReturnType<typeof vi.fn>;
  let dialogService: DialogPort;
  let wiringService: WiringPort;
  const terminalId = "test-terminal-id";

  beforeEach(() => {
    PathFactory.setDefinitions(featureShellPathAdapterDefinitions);
    configService = new ConfigServiceMock();
    configService.setConfig({
      font: { enable_ligatures: false },
      notification: {
        long_running_commands: {
          enabled: true,
          minimum_duration_seconds: 10,
        },
      },
      notifications: {
        app: { available: true, enabled: false },
        os: { available: true, enabled: false },
      },
    } as any);
    appBus = getAppBus();
    vi.spyOn(appBus, "publish");

    shellProfile = {
      shell_type: "Bash",
      inject_cogno_cli: false,
      enable_shell_integration: false,
    };

    preloadForShellIntegrationMock = vi.fn();
    featureSuggestorService = {
      preloadForShellIntegration: preloadForShellIntegrationMock,
    };

    processInfoDialogRef = new DialogRef<void>(1, vi.fn());
    closeProcessInfoDialogSpy = vi.spyOn(processInfoDialogRef, "close");
    openDialogMock = vi.fn().mockReturnValue(processInfoDialogRef);
    dialogService = {
      open: openDialogMock,
    };

    wiringService = {
      getShellDefinitions: vi
        .fn<() => ReadonlyArray<ShellDefinitionContract>>()
        .mockReturnValue([]),
      getNotificationChannels: vi
        .fn<() => ReadonlyArray<NotificationChannelContract>>()
        .mockReturnValue([
          { displayName: "App", id: "app", sortOrder: 100, dispatch: vi.fn() },
          { displayName: "OS", id: "os", sortOrder: 90, dispatch: vi.fn() },
        ]),
    };

    const contextMenuOverlayService: ContextMenuOverlayPort = {
      openContextForElement: vi.fn(),
    };

    session = new TerminalSession(
      configService,
      appBus,
      getStateManager(),
      featureSuggestorService,
      dialogService,
      wiringService,
      contextMenuOverlayService,
    );
  });

  it("should initialize with correct renderer settings based on config", () => {
    configService.setConfig({ terminal: { webgl: true }, font: { family: "Fira Code" } } as any);
    session = new TerminalSession(
      configService,
      appBus,
      getStateManager(),
      featureSuggestorService,
      dialogService,
      wiringService,
      { openContextForElement: vi.fn() },
    );

    expect(Renderer).toHaveBeenCalledWith(expect.objectContaining({ terminal: { webgl: true } }));
  });

  it("should initialize terminal and register handlers", () => {
    configService.setConfig({ font: { enable_ligatures: false } } as any);
    const mockElement = document.createElement("div");
    session.initialize(terminalId, shellProfile);
    session.initializeTerminal(mockElement);

    const rendererInstance = vi.mocked(Renderer).mock.results[0].value;
    expect(rendererInstance.open).toHaveBeenCalledWith(mockElement, false);
    expect(rendererInstance.register).toHaveBeenCalledTimes(14);
  });

  it("should enable shell integration features if configured", () => {
    configService.setConfig({ font: { enable_ligatures: false } } as any);
    shellProfile.enable_shell_integration = true;
    const mockElement = document.createElement("div");
    session.initialize(terminalId, shellProfile);
    session.initializeTerminal(mockElement);

    const rendererInstance =
      vi.mocked(Renderer).mock.results[vi.mocked(Renderer).mock.results.length - 1].value;
    expect(rendererInstance.register).toHaveBeenCalledTimes(16);
    expect(preloadForShellIntegrationMock).toHaveBeenCalledWith("Bash");
  });

  it("should build context menu", () => {
    session.initialize(terminalId, shellProfile);
    const items = session.buildContextMenu();
    expect(items.length).toBeGreaterThan(0);
    expect(items.find((i) => i.label === "Paste")).toBeDefined();
    expect(items.find((i) => i.label === "Maximize")).toBeDefined();
    expect(items.find((i) => i.label === "Process Info")).toBeUndefined();
    expect(items.find((i) => i.label?.includes("Notifications"))).toBeUndefined();
  });

  it("should show Minimize when pane is maximized", () => {
    session.initialize(terminalId, shellProfile);
    appBus.publish({
      type: "PaneMaximizedChanged",
      payload: { terminalId },
    } as any);

    const items = session.buildContextMenu();
    expect(items.find((i) => i.label === "Minimize")).toBeDefined();
    expect(items.find((i) => i.label === "Maximize")).toBeUndefined();
  });

  it("should only show available notification channels in header menu", () => {
    configService.setConfig({
      notification: {
        long_running_commands: {
          enabled: true,
          minimum_duration_seconds: 10,
        },
      },
      notifications: {
        app: { available: true, enabled: false },
        os: { available: false, enabled: false },
      },
    } as any);
    session.initialize(terminalId, shellProfile);

    const items = session.buildHeaderMenu();
    expect(items[0]).toEqual(expect.objectContaining({ header: true, label: "Command Alerts" }));
    const longRunningCommandToggle = items.find((i) => i.label === "Long Commands");
    expect(items).toContainEqual(expect.objectContaining({ header: true, label: "Channels" }));
    expect(items[items.findIndex((i) => i.label === "Process Info") - 1]).toEqual(
      expect.objectContaining({ separator: true }),
    );
    const appToggle = items.find((i) => i.label === "App");
    expect(longRunningCommandToggle).toBeDefined();
    expect(longRunningCommandToggle?.toggle).toBe(true);
    expect(longRunningCommandToggle?.toggled).toBe(true);
    expect(appToggle).toBeDefined();
    expect(appToggle?.toggle).toBe(true);
    expect(appToggle?.toggled).toBe(false);
    expect(items.find((i) => i.label === "OS")).toBeUndefined();
  });

  it("should keep command menu items out of the terminal header menu", () => {
    session.initialize(terminalId, shellProfile);
    const stateManager = getStateManager();
    stateManager.updateCommand({ id: "1" });
    stateManager.updateCommands([
      Object.assign(stateManager.commands[0], {
        isFirstCommandOutOfViewport: true,
      }),
    ]);
    stateManager.commands[0].set("command", "cat bible.txt");

    const items = session.buildHeaderMenu();

    expect(items.find((item) => item.label === "Copy Command")).toBeUndefined();
    expect(items.find((item) => item.label === "Copy Output")).toBeUndefined();
    expect(items.find((item) => item.label === "Scroll to Top")).toBeUndefined();
    expect(items.find((item) => item.label === "Scroll to Bottom")).toBeUndefined();
    expect(items.find((item) => item.label === "Filter Block")).toBeUndefined();
    expect(items[items.length - 1]).toEqual(expect.objectContaining({ label: "Process Info" }));
  });

  it("should include command menu items in the header menu for the first command out of view", () => {
    session.initialize(terminalId, shellProfile);
    const stateManager = getStateManager();
    stateManager.updateCommand({ id: "1" });
    const rendererInstance = vi.mocked(Renderer).mock.results[0].value;
    vi.mocked(rendererInstance.terminal.buffer.active.getLine).mockImplementation(
      (lineIndex: number) => {
        if (lineIndex === 0) return TerminalMockFactory.createLine("^^#1");
        if (lineIndex === 1) return TerminalMockFactory.createLine("first output line");
        if (lineIndex === 2) return TerminalMockFactory.createLine("second output line");
        if (lineIndex === 3) return TerminalMockFactory.createLine("^^#2");
        return null;
      },
    );
    rendererInstance.terminal.buffer.active.length = 4;

    stateManager.updateCommands([
      Object.assign(stateManager.commands[0], {
        isFirstCommandOutOfViewport: true,
      }),
    ]);
    stateManager.commands[0].set("command", "cat bible.txt");

    const items = session.buildHeaderCommandMenu();

    expect(items.find((item) => item.label === "Copy Command")).toBeDefined();
    expect(items.find((item) => item.label === "Copy Output")).toBeDefined();
    expect(items.find((item) => item.label === "Scroll to Top")).toBeDefined();
    expect(items.find((item) => item.label === "Scroll to Bottom")).toBeDefined();
    expect(items.find((item) => item.label === "Filter Block")).toBeDefined();
    expect(items[2]).toEqual(expect.objectContaining({ separator: true }));
    expect(items[5]).toEqual(expect.objectContaining({ separator: true }));

    items.find((item) => item.label === "Scroll to Top")?.action?.();
    items.find((item) => item.label === "Scroll to Bottom")?.action?.();

    expect(rendererInstance.terminal.scrollToLine).toHaveBeenNthCalledWith(1, 0);
    expect(rendererInstance.terminal.scrollToLine).toHaveBeenNthCalledWith(2, 2);
  });

  it("should allow toggling long-running command notifications from the header menu", () => {
    configService.setConfig({
      notification: {
        long_running_commands: {
          enabled: true,
          minimum_duration_seconds: 10,
        },
      },
      notifications: {
        app: { available: true, enabled: true },
      },
    } as any);
    session.initialize(terminalId, shellProfile);

    const toggleItem = session.buildHeaderMenu().find((item) => item.label === "Long Commands");
    expect(toggleItem?.toggled).toBe(true);

    toggleItem?.action?.(toggleItem);

    expect(toggleItem?.toggled).toBe(false);
  });

  it("should publish a notification when a long-running command has finished", () => {
    configService.setConfig({
      notification: {
        long_running_commands: {
          enabled: true,
          minimum_duration_seconds: 10,
        },
      },
      notifications: {
        app: { available: true, enabled: true },
      },
    } as any);
    session.initialize(terminalId, shellProfile);

    (session as any).completedCommandNotificationHandler.handleCompletedCommand({
      command: "pnpm test",
      duration: 12_000,
      directory: "/workspace",
      returnCode: 0,
    });

    expect(appBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        path: ["notification"],
        type: "Notification",
        payload: expect.objectContaining({
          header: "Long-running command finished",
          terminalId,
          channels: { app: true, os: false },
        }),
      }),
    );
  });

  it("should not publish a notification when a command is shorter than the configured threshold", () => {
    configService.setConfig({
      notification: {
        long_running_commands: {
          enabled: true,
          minimum_duration_seconds: 10,
        },
      },
      notifications: {
        app: { available: true, enabled: true },
      },
    } as any);
    session.initialize(terminalId, shellProfile);
    vi.clearAllMocks();

    (session as any).completedCommandNotificationHandler.handleCompletedCommand({
      command: "pnpm test",
      duration: 9_000,
      directory: "/workspace",
      returnCode: 0,
    });

    expect(appBus.publish).not.toHaveBeenCalled();
  });

  it("should publish TerminalRemoved event and dispose resources on dispose", () => {
    session.initialize(terminalId, shellProfile);
    session.dispose();
    expect(appBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "TerminalRemoved",
        payload: terminalId,
      }),
    );

    const rendererInstance = vi.mocked(Renderer).mock.results[0].value;
    expect(rendererInstance.dispose).toHaveBeenCalled();
  });

  it("should not dispose twice", () => {
    session.initialize(terminalId, shellProfile);
    session.dispose();
    vi.clearAllMocks();
    session.dispose();
    expect(appBus.publish).not.toHaveBeenCalled();
  });

  it("should close process info dialog when terminal session is disposed", () => {
    session.initialize(terminalId, shellProfile);
    const processInfoItem = session.buildHeaderMenu().find((item) => item.label === "Process Info");

    processInfoItem?.action?.();
    expect(openDialogMock).toHaveBeenCalledTimes(1);

    session.dispose();
    expect(closeProcessInfoDialogSpy).toHaveBeenCalledTimes(1);
  });

  it("should inject dropped file paths as shell-safe terminal input", () => {
    session.initialize(terminalId, shellProfile);

    session.insertPaths(["C:\\temp\\plain.txt", "C:\\temp\\with space.txt"]);

    expect(appBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        path: ["app", "terminal"],
        type: "InjectTerminalInput",
        payload: {
          terminalId,
          text: "/c/temp/plain.txt '/c/temp/with space.txt'",
        },
      }),
    );
  });
});
