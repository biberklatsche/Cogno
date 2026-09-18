import type { DestroyRef } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import type { TauriMenu } from "@cogno/platform/native-menu";
import { OsPlatform } from "@cogno/platform/os";
import type { AppWindow } from "@cogno/platform/window";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NativeMenuService } from "./native-menu.service";

const menuItemActionCallbacks = new Map<string, () => void>();

const osStub = { platform: () => "linux" } as unknown as OsPlatform;

const appWindowStub = {
  onFocusChanged$: {
    pipe: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
  },
} as unknown as AppWindow;
const tauriMenuStub = {
  newPredefinedItem: vi.fn(async (config: unknown) => ({ kind: "predefined", config })),
  newItem: vi.fn(async (config: { id: string; action: () => void }) => {
    menuItemActionCallbacks.set(config.id, config.action);
    return { kind: "item", ...config };
  }),
  newSubmenu: vi.fn(async (config: Record<string, unknown>) => ({ kind: "submenu", ...config })),
  new: vi.fn(async ({ items }: { items: unknown[] }) => ({
    items,
    setAsAppMenu: vi.fn(async () => undefined),
  })),
} as unknown as TauriMenu;

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
      get diagnostics$(): never {
        throw new Error("not implemented");
      },
      get loaded$(): never {
        throw new Error("not implemented");
      },
      load: () => Promise.resolve(),
      reload: () => Promise.resolve(),
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
          configPath: "feature.ai",
        },
        {
          id: "workspace",
          title: "Workspace",
          order: 1,
          icon: "mdiFolder",
          actionName: "open_workspace",
          configPath: "feature.workspace",
        },
      ]),
    };

    nativeMenuService = new NativeMenuService(
      tauriMenuStub,
      appWindowStub,
      osStub,
      appBus,
      keybindService,
      appWiringService as never,
      configService,
      destroyRef,
    );
    (nativeMenuService as unknown as { latestConfig?: Record<string, unknown> }).latestConfig = {
      feature: {
        workspace: { mode: "on" },
        ai: { mode: "off" },
      },
    };
  });

  it("builds a native menu with feature enablement derived from config", async () => {
    await (nativeMenuService as unknown as { buildMenu: () => Promise<void> }).buildMenu();

    const newItemCalls = vi.mocked(tauriMenuStub.newItem).mock.calls;
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
      return { defaultPrevented: false };
    });

    await (nativeMenuService as unknown as { buildMenu: () => Promise<void> }).buildMenu();

    menuItemActionCallbacks.get("open_workspace")?.();

    expect(publishedEvents).toContainEqual(
      expect.objectContaining(ActionFired.create("open_workspace")),
    );
  });

  it("falls back to a plain action event when the definition is missing and reports feature modes", async () => {
    vi.mocked(keybindService.getActionDefinition).mockReturnValue(undefined as never);

    expect(
      (
        nativeMenuService as unknown as { getFeatureMode: (configPath: string) => unknown }
      ).getFeatureMode("feature.workspace"),
    ).toBe("on");
    expect(
      (
        nativeMenuService as unknown as { getFeatureMode: (configPath: string) => unknown }
      ).getFeatureMode("feature.ai"),
    ).toBe("off");
    expect(
      (
        nativeMenuService as unknown as { getFeatureMode: (configPath: string) => unknown }
      ).getFeatureMode("feature.missing"),
    ).toBeUndefined();

    const publishedEvents: unknown[] = [];
    vi.spyOn(appBus, "publish").mockImplementation((event) => {
      publishedEvents.push(event);
      return { defaultPrevented: false };
    });

    await (nativeMenuService as unknown as { buildMenu: () => Promise<void> }).buildMenu();

    // A missing action definition must not break the menu item: the callback
    // degrades to publishing a plain ActionFired for the action name.
    expect(() => menuItemActionCallbacks.get("open_workspace")?.()).not.toThrow();
    expect(publishedEvents).toContainEqual(
      expect.objectContaining(ActionFired.create("open_workspace")),
    );
  });
});
