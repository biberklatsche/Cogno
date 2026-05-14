import type { DestroyRef } from "@angular/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionFired } from "../../action/action.models";
import { AppBus } from "../../app-bus/app-bus";
import { ConfigService } from "../../config/+state/config.service";
import { KeybindService } from "../../keybinding/keybind.service";
import { NativeMenuService } from "./native-menu.service";

const menuItemActionCallbacks = new Map<string, () => void>();

vi.mock("@cogno/app-tauri/os", () => ({
  OS: {
    platform: vi.fn(() => "linux"),
  },
}));

vi.mock("@cogno/app-tauri/window", () => ({
  AppWindow: {
    onFocusChanged$: {
      pipe: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    },
  },
}));

vi.mock("@cogno/app-tauri/native-menu", () => ({
  TauriMenu: {
    newPredefinedItem: vi.fn(async (config: unknown) => ({ kind: "predefined", config })),
    newItem: vi.fn(async (config: { id: string; action: () => void }) => {
      menuItemActionCallbacks.set(config.id, config.action);
      return { kind: "item", ...config };
    }),
    newSubmenu: vi.fn(async (config: unknown) => ({ kind: "submenu", ...config })),
    new: vi.fn(async ({ items }: { items: unknown[] }) => ({
      items,
      setAsAppMenu: vi.fn(async () => undefined),
    })),
  },
}));

describe("NativeMenuService", () => {
  let appBus: AppBus;
  let keybindService: KeybindService;
  let configService: ConfigService;
  let destroyRef: DestroyRef;
  let appWiringService: {
    getSideMenuFeatureDefinitions: ReturnType<typeof vi.fn>;
  };
  let nativeMenuService: NativeMenuService;

  beforeEach(() => {
    vi.clearAllMocks();
    menuItemActionCallbacks.clear();

    appBus = new AppBus();
    keybindService = {
      getKeybinding: vi.fn().mockImplementation((actionName: string) => `Cmd+${actionName}`),
      getActionDefinition: vi.fn().mockImplementation((actionName: string) => ({
        id: actionName,
        actionName,
        payload: actionName,
      })),
    } as unknown as KeybindService;
    configService = {
      get config() {
        return {} as never;
      },
      get config$() {
        return {
          pipe: vi.fn().mockReturnThis(),
          subscribe: vi.fn(),
        } as never;
      },
      getShellProfileOrDefault: vi.fn(),
      getOrderedShellProfiles: vi.fn(),
      getShellProfileByShortcutIndex: vi.fn(),
      getPromptSegments: vi.fn(),
    };
    destroyRef = {
      onDestroy: vi.fn(),
    } as unknown as DestroyRef;
    appWiringService = {
      getSideMenuFeatureDefinitions: vi.fn().mockReturnValue([
        {
          id: "ai",
          title: "AI",
          order: 2,
          icon: "mdiRobot",
          actionName: "open_ai",
          configPath: "ai",
        },
        {
          id: "workspace",
          title: "Workspace",
          order: 1,
          icon: "mdiFolder",
          actionName: "open_workspace",
          configPath: "workspace",
        },
      ]),
    };

    nativeMenuService = new NativeMenuService(
      appBus,
      keybindService,
      appWiringService as never,
      configService,
      destroyRef,
    );
    (nativeMenuService as unknown as { latestConfig?: Record<string, unknown> }).latestConfig = {
      workspace: { mode: "visible" },
      ai: { mode: "off" },
    };
  });

  it("builds a native menu with feature enablement derived from config", async () => {
    await (nativeMenuService as unknown as { buildMenu: () => Promise<void> }).buildMenu();

    const { TauriMenu } = await import("@cogno/app-tauri/native-menu");
    const newItemCalls = vi.mocked(TauriMenu.newItem).mock.calls;
    const workspaceCall = newItemCalls.find((call) => call[0].id === "open_workspace");
    const aiCall = newItemCalls.find((call) => call[0].id === "open_ai");

    expect(workspaceCall?.[0]).toEqual(
      expect.objectContaining({
        text: "Workspace",
        enabled: true,
        accelerator: "Cmd+open_workspace",
      }),
    );
    expect(aiCall?.[0]).toEqual(
      expect.objectContaining({
        text: "AI",
        enabled: false,
        accelerator: "Cmd+open_ai",
      }),
    );
  });

  it("publishes action events when menu item callbacks are executed", async () => {
    const publishedEvents: unknown[] = [];
    vi.spyOn(appBus, "publish").mockImplementation((event) => {
      publishedEvents.push(event);
    });

    await (nativeMenuService as unknown as { buildMenu: () => Promise<void> }).buildMenu();

    menuItemActionCallbacks.get("open_workspace")?.();

    expect(publishedEvents).toContainEqual(
      expect.objectContaining(ActionFired.create("open_workspace")),
    );
  });

  it("throws when an action definition is missing and reports feature modes", async () => {
    vi.mocked(keybindService.getActionDefinition).mockReturnValue(undefined as never);

    expect(
      (
        nativeMenuService as unknown as { getFeatureMode: (configPath: string) => unknown }
      ).getFeatureMode("workspace"),
    ).toBe("visible");
    expect(
      (
        nativeMenuService as unknown as { getFeatureMode: (configPath: string) => unknown }
      ).getFeatureMode("ai"),
    ).toBe("off");
    expect(
      (
        nativeMenuService as unknown as { getFeatureMode: (configPath: string) => unknown }
      ).getFeatureMode("missing"),
    ).toBeUndefined();

    await (nativeMenuService as unknown as { buildMenu: () => Promise<void> }).buildMenu();

    expect(() => menuItemActionCallbacks.get("open_workspace")?.()).toThrow(
      "Action definition open_workspace not found.",
    );
  });
});
