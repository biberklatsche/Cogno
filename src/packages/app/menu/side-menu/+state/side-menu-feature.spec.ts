import type { DestroyRef } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppBus } from "../../../app-bus/app-bus";
import { ConfigService } from "../../../config/+state/config.service";
import { KeybindService } from "../../../keybinding/keybind.service";
import { SideMenuService } from "./side-menu.service";
import { SideMenuFeature } from "./side-menu-feature";
import { SideMenuFeatureDefinition } from "./side-menu-feature-ui.contract";

class DummyComponent {}

describe("SideMenuFeature", () => {
  let appBus: AppBus;
  let configSubject: BehaviorSubject<Record<string, unknown>>;
  let configService: ConfigService;
  let sideMenuService: {
    addMenuItem: ReturnType<typeof vi.fn>;
    removeMenuItem: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    updateIcon: ReturnType<typeof vi.fn>;
    isSelected: ReturnType<typeof vi.fn>;
  };
  let keybindService: {
    registerListener: ReturnType<typeof vi.fn>;
    unregisterListener: ReturnType<typeof vi.fn>;
  };
  let destroyRef: DestroyRef;
  let onDestroyHandler: (() => void) | undefined;

  const definition: SideMenuFeatureDefinition = {
    id: "workspace",
    title: "Workspace",
    icon: "mdiFolder",
    order: 1,
    actionName: "open_workspace",
    configPath: "workspace",
    targetComponent: DummyComponent,
  };

  beforeEach(() => {
    appBus = new AppBus();
    configSubject = new BehaviorSubject<Record<string, unknown>>({
      workspace: { mode: "visible" },
    });
    configService = {
      get config() {
        return configSubject.value as never;
      },
      get config$() {
        return configSubject.asObservable() as never;
      },
      getShellProfileOrDefault: vi.fn(),
      getOrderedShellProfiles: vi.fn(),
      getShellProfileByShortcutIndex: vi.fn(),
      getPromptSegments: vi.fn(),
    };
    sideMenuService = {
      addMenuItem: vi.fn(),
      removeMenuItem: vi.fn(),
      open: vi.fn(),
      close: vi.fn(),
      updateIcon: vi.fn(),
      isSelected: vi.fn().mockReturnValue(false),
    };
    keybindService = {
      registerListener: vi.fn(),
      unregisterListener: vi.fn(),
    };
    destroyRef = {
      onDestroy: vi.fn((handler: () => void) => {
        onDestroyHandler = handler;
      }),
    } as unknown as DestroyRef;
  });

  it("reacts to feature mode changes and availability", () => {
    const lifecycle = {
      onModeChange: vi.fn(),
    };

    new SideMenuFeature(
      {
        ...definition,
        isAvailable: vi.fn().mockImplementation((config: Record<string, unknown>) => {
          return config["workspace_available"] !== false;
        }),
      },
      lifecycle,
      sideMenuService as unknown as SideMenuService,
      appBus,
      configService,
      keybindService as unknown as KeybindService,
      destroyRef,
    );

    expect(sideMenuService.addMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Workspace", hidden: false }),
    );

    configSubject.next({ workspace: { mode: "hidden" } });
    expect(sideMenuService.addMenuItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ label: "Workspace", hidden: true }),
    );

    configSubject.next({ workspace: { mode: "off" } });
    expect(sideMenuService.removeMenuItem).toHaveBeenCalledWith("Workspace");

    vi.mocked(sideMenuService.isSelected).mockReturnValue(true);
    configSubject.next({ workspace_available: false, workspace: { mode: "visible" } });
    expect(sideMenuService.close).toHaveBeenCalledWith(true);
    expect(lifecycle.onModeChange).toHaveBeenCalled();
  });

  it("wires action handling, lifecycle callbacks and teardown", () => {
    const lifecycle = {
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onFocus: vi.fn(),
      onBlur: vi.fn(),
    };

    const feature = new SideMenuFeature(
      definition,
      lifecycle,
      sideMenuService as unknown as SideMenuService,
      appBus,
      configService,
      keybindService as unknown as KeybindService,
      destroyRef,
    );

    appBus.publish({ type: "SideMenuViewOpened", payload: { label: "Workspace" } });
    appBus.publish({ type: "SideMenuViewFocused", payload: { label: "Workspace" } });
    appBus.publish({ type: "SideMenuViewBlurred", payload: { label: "Workspace" } });
    appBus.publish({ type: "SideMenuViewClosed", payload: { label: "Workspace" } });

    expect(lifecycle.onOpen).toHaveBeenCalled();
    expect(lifecycle.onFocus).toHaveBeenCalled();
    expect(lifecycle.onBlur).toHaveBeenCalled();
    expect(lifecycle.onClose).toHaveBeenCalled();

    const actionEvent = { type: "ActionFired", path: ["app", "action"], payload: "open_workspace" };
    appBus.publish(actionEvent);
    expect(sideMenuService.open).toHaveBeenCalledWith("Workspace");
    expect((actionEvent as { performed?: boolean }).performed).toBe(true);

    feature.registerKeybindListener(["Enter"], vi.fn());
    feature.unregisterKeybindListener();
    feature.updateIcon("mdiRobot");
    feature.close();

    expect(keybindService.registerListener).toHaveBeenCalledWith(
      "workspace",
      ["Enter"],
      expect.any(Function),
    );
    expect(keybindService.unregisterListener).toHaveBeenCalledWith("workspace");
    expect(sideMenuService.updateIcon).toHaveBeenCalledWith("Workspace", "mdiRobot");
    expect(sideMenuService.close).toHaveBeenCalled();

    onDestroyHandler?.();
    appBus.publish({ type: "ActionFired", path: ["app", "action"], payload: "open_workspace" });
    expect(sideMenuService.open).toHaveBeenCalledTimes(1);
  });
});
