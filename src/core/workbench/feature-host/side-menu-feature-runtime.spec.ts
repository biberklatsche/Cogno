import type { Injector } from "@angular/core";
import type { ApplicationConfigurationPort } from "@cogno/core/api/application-configuration-port";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import type { SideMenuService } from "@cogno/core/workbench/side-menu/+state/side-menu.service";
import type { SideMenuFeatureDefinition } from "@cogno/core/workbench/side-menu/+state/side-menu-feature-definitions";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SideMenuFeatureRuntime } from "./side-menu-feature-runtime";

class DummyComponent {}

describe("SideMenuFeatureRuntime", () => {
  let appBus: AppBus;
  let configSubject: BehaviorSubject<Record<string, unknown>>;
  let applicationConfigurationPort: ApplicationConfigurationPort;
  let injector: Injector;
  let sideMenuService: {
    addMenuItem: ReturnType<typeof vi.fn>;
    removeMenuItem: ReturnType<typeof vi.fn>;
    isSelected: ReturnType<typeof vi.fn>;
    toggle: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    updateBadgeColor: ReturnType<typeof vi.fn>;
    resolveComponent: ReturnType<typeof vi.fn>;
  };
  let keybindService: {
    registerListener: ReturnType<typeof vi.fn>;
    unregisterListener: ReturnType<typeof vi.fn>;
  };

  const definition: SideMenuFeatureDefinition = {
    id: "workspace",
    title: "Workspace",
    icon: "mdiFolder",
    order: 1,
    actionName: "open_workspace",
    configPath: "feature.workspace",
    targetComponent: DummyComponent,
  };

  function createRuntime(lifecycle: Record<string, unknown> = {}): SideMenuFeatureRuntime {
    injector = { get: vi.fn() } as unknown as Injector;
    const withLifecycle: SideMenuFeatureDefinition = {
      ...definition,
      createLifecycle: () => lifecycle,
    };
    return new SideMenuFeatureRuntime(
      withLifecycle,
      injector,
      sideMenuService as unknown as SideMenuService,
      appBus,
      keybindService as unknown as KeybindService,
      applicationConfigurationPort,
    );
  }

  beforeEach(() => {
    appBus = new AppBus();
    configSubject = new BehaviorSubject<Record<string, unknown>>({
      feature: { workspace: { mode: "on" } },
    });
    applicationConfigurationPort = {
      configuration$: configSubject.asObservable(),
      getConfiguration: vi.fn(() => configSubject.value),
    } as unknown as ApplicationConfigurationPort;
    sideMenuService = {
      addMenuItem: vi.fn(),
      removeMenuItem: vi.fn(),
      isSelected: vi.fn(() => false),
      toggle: vi.fn(),
      close: vi.fn(),
      updateBadgeColor: vi.fn(),
      resolveComponent: vi.fn(),
    };
    keybindService = {
      registerListener: vi.fn(),
      unregisterListener: vi.fn(),
    };
  });

  it("adds the entry on activate and removes it on dispose", () => {
    const lifecycle = { onModeChange: vi.fn() };
    const runtime = createRuntime(lifecycle);

    runtime.activate();
    expect(lifecycle.onModeChange).toHaveBeenCalledWith("on");
    expect(sideMenuService.addMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Workspace", order: 1 }),
    );

    runtime.dispose();
    expect(lifecycle.onModeChange).toHaveBeenCalledWith("off");
    expect(sideMenuService.close).not.toHaveBeenCalled();
    expect(sideMenuService.removeMenuItem).toHaveBeenCalledWith("Workspace");
  });

  it("closes the panel on dispose when it is open, before the lifecycle goes off", () => {
    const calls: string[] = [];
    sideMenuService.isSelected.mockReturnValue(true);
    sideMenuService.close.mockImplementation(() => calls.push("close"));
    const runtime = createRuntime({ onModeChange: vi.fn(() => calls.push("onModeChange")) });
    runtime.activate();
    calls.length = 0;

    runtime.dispose();

    expect(sideMenuService.isSelected).toHaveBeenCalledWith("Workspace");
    expect(sideMenuService.close).toHaveBeenCalledWith(true);
    expect(calls).toEqual(["close", "onModeChange"]);
  });

  it("follows a config order override and falls back to the default", () => {
    const runtime = createRuntime();
    runtime.activate();
    expect(sideMenuService.addMenuItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: 1 }),
    );

    configSubject.next({ feature: { workspace: { mode: "on", order: 5 } } });
    expect(sideMenuService.addMenuItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: 5 }),
    );

    configSubject.next({ feature: { workspace: { mode: "on" } } });
    expect(sideMenuService.addMenuItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: 1 }),
    );
  });

  it("routes view events to the lifecycle and the action to toggle", () => {
    const lifecycle = { onOpen: vi.fn(), onClose: vi.fn(), onFocus: vi.fn(), onBlur: vi.fn() };
    const runtime = createRuntime(lifecycle);
    runtime.activate();

    appBus.publish({ type: "SideMenuViewOpened", payload: { label: "Workspace" } });
    appBus.publish({ type: "SideMenuViewFocused", payload: { label: "Workspace" } });
    appBus.publish({ type: "SideMenuViewBlurred", payload: { label: "Workspace" } });
    appBus.publish({ type: "SideMenuViewClosed", payload: { label: "Workspace" } });
    expect(lifecycle.onOpen).toHaveBeenCalled();
    expect(lifecycle.onFocus).toHaveBeenCalled();
    expect(lifecycle.onBlur).toHaveBeenCalled();
    expect(lifecycle.onClose).toHaveBeenCalled();

    const actionEvent = { type: "ActionFired", payload: "open_workspace" };
    appBus.publish(actionEvent as never);
    expect(sideMenuService.toggle).toHaveBeenCalledWith("Workspace");
    expect((actionEvent as { performed?: boolean }).performed).toBe(true);
  });

  it("binds Escape to close while the view has focus, before the lifecycle binds its own keys", () => {
    const calls: string[] = [];
    keybindService.registerListener.mockImplementation((_id, keys: string[]) =>
      calls.push(`register ${keys.join(",")}`),
    );
    keybindService.unregisterListener.mockImplementation(() => calls.push("unregister"));
    const lifecycle = {
      onFocus: vi.fn(() => calls.push("onFocus")),
      onBlur: vi.fn(() => calls.push("onBlur")),
    };
    const runtime = createRuntime(lifecycle);
    runtime.activate();

    appBus.publish({ type: "SideMenuViewFocused", payload: { label: "Workspace" } });
    const [id, keys, onEscape] = keybindService.registerListener.mock.calls[0];
    expect(id).toBe("feature.workspace");
    expect(keys).toEqual(["Escape"]);
    onEscape({ key: "Escape" } as KeyboardEvent);
    expect(sideMenuService.close).toHaveBeenCalledTimes(1);

    appBus.publish({ type: "SideMenuViewBlurred", payload: { label: "Workspace" } });
    expect(keybindService.unregisterListener).toHaveBeenCalledWith("feature.workspace");
    expect(calls).toEqual(["register Escape", "onFocus", "onBlur", "unregister"]);
  });

  it("drops the feature's keys on dispose", () => {
    const runtime = createRuntime();
    runtime.activate();
    runtime.dispose();

    expect(keybindService.unregisterListener).toHaveBeenCalledWith("feature.workspace");
  });

  it("exposes the feature handle", () => {
    const runtime = createRuntime();
    runtime.activate();

    runtime.registerKeybindListener(["Enter"], vi.fn());
    runtime.updateBadgeColor("var(--color-yellow)");
    runtime.close();

    expect(keybindService.registerListener).toHaveBeenCalledWith(
      "feature.workspace",
      ["Enter"],
      expect.any(Function),
    );
    expect(sideMenuService.updateBadgeColor).toHaveBeenCalledWith(
      "Workspace",
      "var(--color-yellow)",
    );
    expect(sideMenuService.close).toHaveBeenCalled();
  });

  it("leaves nothing subscribed after dispose (leak check)", () => {
    const lifecycle = { onOpen: vi.fn() };
    const runtime = createRuntime(lifecycle);
    runtime.activate();
    runtime.dispose();

    // View events, the open action and the order override are all detached.
    appBus.publish({ type: "SideMenuViewOpened", payload: { label: "Workspace" } });
    appBus.publish({
      type: "ActionFired",
      payload: "open_workspace",
    } as never);
    sideMenuService.addMenuItem.mockClear();
    configSubject.next({ feature: { workspace: { mode: "on", order: 9 } } });

    expect(lifecycle.onOpen).not.toHaveBeenCalled();
    expect(sideMenuService.toggle).not.toHaveBeenCalled();
    expect(sideMenuService.addMenuItem).not.toHaveBeenCalled();
  });
});
