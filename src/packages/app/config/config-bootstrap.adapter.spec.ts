import type { DestroyRef } from "@angular/core";
import type { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import type { ConfigDiagnostic } from "@cogno/core/infrastructure/config/config.mapper";
import type {
  ConfigLoadOptions,
  ConfigService,
} from "@cogno/core/infrastructure/config/config.service";
import type { Config } from "@cogno/core/infrastructure/config/models/config";
import type { ShellConfigurator } from "@cogno/core/session/shells/shell-configurator";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
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
  } as unknown as AppWiringService;
  const destroyRef = { onDestroy: vi.fn() } as unknown as DestroyRef;

  const notifications: unknown[] = [];
  bus.on$({ path: ["notification"] }).subscribe((message) => notifications.push(message));
  const configLoadedEvents: unknown[] = [];
  bus
    .on$({ path: ["app", "settings"], type: "ConfigLoaded" })
    .subscribe((message) => configLoadedEvents.push(message));

  new ConfigBootstrapAdapter(bus, config, shells, wiring, shellIntegrationStub, destroyRef);

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

    bus.publish({ type: "InitConfigCommand", path: ["app"] });
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

  it("fills in shell profiles only when the config has none", async () => {
    const { bus, shells, loadOptions } = setup();

    bus.publish({ type: "InitConfigCommand", path: ["app"] });
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
