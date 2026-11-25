import type { DestroyRef } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import type { TauriMenu } from "@cogno/platform/native-menu";
import { OsPlatform } from "@cogno/platform/os";
import type { AppWindow } from "@cogno/platform/window";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  new: vi.fn(async ({ items }: { items: unknown[] }) => ({ items })),
  setAsAppMenu: vi.fn(async () => undefined),
  releaseAll: vi.fn(async () => undefined),
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
      load: () => Promise.resolve(),
      reload: () => Promise.resolve(),
      update: () => Promise.resolve(),
      get schema(): never {
        throw new Error("not implemented");
      },
      get userKeys$(): never {
        throw new Error("not implemented");
      },
      get defaultSettings(): never {
        throw new Error("not implemented");
      },
      getShellProfileOrDefault: vi.fn(),
      getOrderedShellProfiles: vi.fn(),
      getShellProfileByShortcutIndex: vi.fn(),
      getPromptSegments: vi.fn(),
      getPromptSeparator: vi.fn(),
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
        {
          id: "git",
          title: "Git",
          order: 3,
          icon: "mdiGit",
          actionName: "open_git",
          configPath: "feature.git",
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
    const gitCall = newItemCalls.find((call) => call[0].id === "open_git");

    // A feature the config says nothing about is on.
    expect(gitCall?.[0]).toEqual(expect.objectContaining({ text: "Git", enabled: true }));
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

  it("offers the system's editing entries, so text fields take Cmd+V and its kin", async () => {
    await (nativeMenuService as unknown as { buildMenu: () => Promise<void> }).buildMenu();

    const submenus = vi
      .mocked(tauriMenuStub.newSubmenu)
      .mock.calls.map(
        (call) => call[0] as unknown as { text: string; items: { config: { item: string } }[] },
      );
    const editSubmenu = submenus.find((submenu) => submenu.text === "Edit");

    expect(editSubmenu?.items.map((item) => item.config.item)).toEqual([
      "Undo",
      "Redo",
      "Separator",
      "Cut",
      "Copy",
      "Paste",
      "SelectAll",
    ]);
  });

  describe("on macOS, a paste from the Edit menu", () => {
    const pasteInto = (element: Element) => {
      const event = new Event("paste", { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    };
    let publishSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      publishSpy = vi.spyOn(appBus, "publish");
      new NativeMenuService(
        tauriMenuStub,
        appWindowStub,
        { platform: () => "macos" } as unknown as OsPlatform,
        appBus,
        keybindService,
        appWiringService as never,
        configService,
        destroyRef,
      );
    });

    afterEach(() => {
      for (const [teardown] of vi.mocked(destroyRef.onDestroy).mock.calls) teardown();
      document.body.innerHTML = "";
    });

    it("is Cogno's paste while a terminal has the keyboard", () => {
      const terminal = document.body.appendChild(document.createElement("div"));
      terminal.className = "terminal xterm";
      const textarea = terminal.appendChild(document.createElement("textarea"));

      expect(pasteInto(textarea)).toBe(true);
      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ payload: "paste" }));
    });

    it("stays the system's paste in a text field", () => {
      const field = document.body.appendChild(document.createElement("input"));

      expect(pasteInto(field)).toBe(false);
      expect(publishSpy).not.toHaveBeenCalled();
    });
  });

  it("releases the previous menu's native objects before it makes the next one's", async () => {
    await (nativeMenuService as unknown as { buildMenu: () => Promise<void> }).buildMenu();

    const firstCallOf = (stub: unknown) =>
      vi.mocked(stub as () => void).mock.invocationCallOrder[0];
    expect(firstCallOf(tauriMenuStub.releaseAll)).toBeLessThan(firstCallOf(tauriMenuStub.newItem));
    expect(tauriMenuStub.setAsAppMenu).toHaveBeenCalledOnce();
  });

  it("on macOS builds one menu after another, never two at once", async () => {
    const config$ = new Subject<Record<string, unknown>>();
    const focus$ = new Subject<boolean>();
    const service = new NativeMenuService(
      tauriMenuStub,
      { onFocusChanged$: focus$ } as unknown as AppWindow,
      { platform: () => "macos" } as unknown as OsPlatform,
      appBus,
      keybindService,
      appWiringService as never,
      { config$ } as unknown as ConfigService,
      destroyRef,
    );
    const steps: string[] = [];
    vi.mocked(tauriMenuStub.releaseAll).mockImplementation(async () => void steps.push("release"));
    vi.mocked(tauriMenuStub.setAsAppMenu).mockImplementation(async () => void steps.push("set"));

    config$.next({});
    focus$.next(true);
    focus$.next(false);
    await (service as unknown as { menuBuilds: Promise<void> }).menuBuilds;

    expect(steps).toEqual(["release", "set", "release", "set"]);
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

  it("falls back to a plain action event when the definition is missing", async () => {
    vi.mocked(keybindService.getActionDefinition).mockReturnValue(undefined as never);

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
