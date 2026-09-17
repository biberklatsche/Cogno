import type { DestroyRef } from "@angular/core";
import type { ConfigDiagnostic } from "@cogno/core/infrastructure/config/config.mapper";
import type {
  ConfigLoadOptions,
  ConfigService,
} from "@cogno/core/infrastructure/config/config.service";
import type { Config } from "@cogno/core/infrastructure/config/models/config";
import type { ShellConfigurator } from "@cogno/core/session/shells/shell-configurator";
import { ActionNameRegistry } from "@cogno/core/workbench/actions/action-name-registry";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { FeatureHost } from "@cogno/core/workbench/feature-host/feature-host";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigBootstrapAdapter } from "./config-bootstrap.adapter";

const shellIntegrationStub = { ensure: async () => undefined } as never;

/**
 * The adapter carries what `ConfigService` gave up when it moved to
 * `core/infrastructure` (migration step 1): actions, notifications and the
 * shell bootstrap. These tests pin the behaviour that must not change while
 * those three find their own layer.
 */
function setup() {
  const bus = new AppBus();
  const loaded = new Subject<Config>();
  const diagnostics = new BehaviorSubject<ReadonlyArray<ConfigDiagnostic>>([]);
  let captured: ConfigLoadOptions | undefined;

  const config = {
    loaded$: loaded.asObservable(),
    diagnostics$: diagnostics.asObservable(),
    load: vi.fn(async (options: ConfigLoadOptions) => {
      captured = options;
    }),
    reload: vi.fn(async () => {}),
  } as unknown as ConfigService;

  const shells = { apply: vi.fn(async () => {}) } as unknown as ShellConfigurator;
  const wiring = {
    getSettingsExtensions: vi.fn().mockReturnValue([]),
    getShellSupportDefinitions: vi.fn().mockReturnValue([]),
  } as unknown as FeatureHost;
  const destroyRef = { onDestroy: vi.fn() } as unknown as DestroyRef;

  const notifications: unknown[] = [];
  bus.on$("Notification").subscribe((message) => notifications.push(message));
  const configLoadedEvents: unknown[] = [];
  bus.on$("ConfigLoaded").subscribe((message) => configLoadedEvents.push(message));

  const featureActionNames = new ActionNameRegistry();
  featureActionNames.register(["open_git"]);

  new ConfigBootstrapAdapter(
    bus,
    config,
    shells,
    wiring,
    shellIntegrationStub,
    featureActionNames,
    destroyRef,
  );

  return {
    bus,
    config,
    shells,
    loaded,
    diagnostics,
    notifications,
    configLoadedEvents,
    loadOptions: () => captured,
  };
}

const diagnostic = (message: string): ConfigDiagnostic =>
  ({ level: "error", message }) as ConfigDiagnostic;

describe("ConfigBootstrapAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the config once the window asks for it", async () => {
    const { bus, config } = setup();

    bus.publish({ type: "InitConfigCommand" });
    await Promise.resolve();

    expect(config.load).toHaveBeenCalledTimes(1);
  });

  it("announces every load on the bus but only toasts the reloads", () => {
    const { loaded, notifications, configLoadedEvents } = setup();

    loaded.next({} as Config);
    expect(configLoadedEvents).toHaveLength(1);
    expect(notifications).toHaveLength(0);

    loaded.next({} as Config);
    expect(configLoadedEvents).toHaveLength(2);
    expect(notifications).toHaveLength(1);
  });

  it("reports diagnostics once and again when they change", () => {
    const { diagnostics, notifications } = setup();

    diagnostics.next([diagnostic("bad key")]);
    expect(notifications).toHaveLength(1);

    diagnostics.next([diagnostic("bad key")]);
    expect(notifications).toHaveLength(1);

    diagnostics.next([diagnostic("another bad key")]);
    expect(notifications).toHaveLength(2);
  });

  describe("a keybind line naming an action nobody declared", () => {
    const load = (keybind: string[]) => {
      const context = setup();
      context.loaded.next({ keybind } as Config);
      context.diagnostics.next([]);
      return context.notifications as Array<{
        payload: { header: string; body: string; type: string };
      }>;
    };

    it("is reported as a config warning with the line and the name", () => {
      const notifications = load(["always:Ctrl+T=new_tab", "Ctrl+Alt+S=splt_right"]);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].payload.header).toBe("Config warnings");
      expect(notifications[0].payload.type).toBe("warning");
      expect(notifications[0].payload.body).toContain('Unknown action "splt_right"');
      expect(notifications[0].payload.body).toContain("Ctrl+Alt+S=splt_right");
    });

    it("is not reported for core actions, feature actions and actions with arguments", () => {
      const notifications = load([
        "Ctrl+T=new_tab",
        "Ctrl+Alt+G=open_git",
        "Ctrl+Shift+1=open_shell_1",
        "Ctrl+K=write_text:hello",
      ]);

      // `write_text` is not a declared action, the other three are.
      expect(notifications).toHaveLength(1);
      expect(notifications[0].payload.body).toContain('Unknown action "write_text"');
      expect(notifications[0].payload.body).not.toContain("new_tab");
      expect(notifications[0].payload.body).not.toContain("open_git");
    });

    it("joins the mapper's own diagnostics in one notification", () => {
      const context = setup();
      context.loaded.next({ keybind: ["Ctrl+Alt+S=splt_right"] } as Config);
      context.diagnostics.next([diagnostic("bad key")]);

      const [notification] = context.notifications as Array<{
        payload: { header: string; body: string };
      }>;
      expect(context.notifications).toHaveLength(1);
      expect(notification.payload.header).toBe("Config errors");
      expect(notification.payload.body).toContain("bad key");
      expect(notification.payload.body).toContain('Unknown action "splt_right"');
    });

    it("is gone once the line is fixed", () => {
      const context = setup();
      context.loaded.next({ keybind: ["Ctrl+Alt+S=splt_right"] } as Config);
      context.diagnostics.next([]);
      context.loaded.next({ keybind: ["Ctrl+Alt+S=split_right"] } as Config);
      context.diagnostics.next([]);

      // One warning for the typo, one "Config loaded" toast for the reload, no second warning.
      const headers = (context.notifications as Array<{ payload: { header: string } }>).map(
        (notification) => notification.payload.header,
      );
      expect(headers).toEqual(["Config warnings", "System"]);
    });
  });

  it("fills in shell profiles only when the config has none", async () => {
    const { bus, shells, loadOptions } = setup();

    bus.publish({ type: "InitConfigCommand" });
    await Promise.resolve();

    const completeDefaults = loadOptions()?.completeDefaults;
    expect(completeDefaults).toBeDefined();

    const withProfiles = { shell: { profiles: { bash: {} } } } as unknown as Config;
    expect(await completeDefaults?.(withProfiles)).toBe(false);
    expect(shells.apply).not.toHaveBeenCalled();

    const withoutProfiles = { shell: { profiles: {} } } as unknown as Config;
    expect(await completeDefaults?.(withoutProfiles)).toBe(true);
    expect(shells.apply).toHaveBeenCalledTimes(1);
  });
});
