import type { DestroyRef } from "@angular/core";
import type { ApplicationConfigurationPort } from "@cogno/core/api/application-configuration-port";
import type { FeatureDefinition } from "@cogno/core/api/contributions";
import type { DatabaseMigrationService } from "@cogno/core/infrastructure/database/database-migration.service";
import type { ActionNameRegistry } from "@cogno/core/workbench/actions/action-name-registry";
import type { ActionName } from "@cogno/core/workbench/bus/action.models";
import { BehaviorSubject } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeatureHost } from "./feature-host";
import type { NotificationChannelFeatureRegistrar } from "./notification-channel-feature-registrar";
import type { SideMenuFeatureRegistrar } from "./side-menu-feature-registrar";

/** A feature with a side-menu entry at `configPath`; only its id and path matter here. */
function sideMenuFeature(id: string, configPath: string): FeatureDefinition<ActionName> {
  return {
    id,
    mode: "on",
    target: "workbench",
    sideMenu: [
      {
        id,
        title: id,
        icon: "mdiCog",
        order: 1,
        actionName: `open_${id}` as ActionName,
        configPath,
        targetComponent: class {},
      },
    ],
  };
}

describe("FeatureHost activation", () => {
  let configSubject: BehaviorSubject<Record<string, unknown>>;
  let register: ReturnType<typeof vi.fn>;
  let unregister: ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeHost(config: Record<string, unknown>): FeatureHost {
    configSubject = new BehaviorSubject<Record<string, unknown>>(config);
    register = vi.fn();
    unregister = vi.fn();
    const databaseMigrationService = {
      registerFeatureMigrations: vi.fn(),
    } as unknown as DatabaseMigrationService;
    const actionNameRegistry = {
      register: vi.fn(),
      getActionNames: () => [],
    } as unknown as ActionNameRegistry;
    const sideMenuRegistrar = { register, unregister } as unknown as SideMenuFeatureRegistrar;
    const notificationChannelRegistrar = {
      register: vi.fn(),
      unregister: vi.fn(),
    } as unknown as NotificationChannelFeatureRegistrar;
    const applicationConfigurationPort = {
      configuration$: configSubject.asObservable(),
      getConfiguration: () => configSubject.value,
    } as unknown as ApplicationConfigurationPort;
    const destroyRef = { onDestroy: vi.fn(() => () => {}) } as unknown as DestroyRef;
    return new FeatureHost(
      [
        sideMenuFeature("coding-agents", "feature.coding_agents"),
        sideMenuFeature("git", "feature.git"),
      ],
      databaseMigrationService,
      actionNameRegistry,
      sideMenuRegistrar,
      notificationChannelRegistrar,
      applicationConfigurationPort,
      destroyRef,
    );
  }

  it("reads the mode from the feature's configPath, not its id", () => {
    const host = makeHost({
      feature: { coding_agents: { mode: "on" }, git: { mode: "off" } },
    });

    expect(register).toHaveBeenCalledWith(expect.objectContaining({ id: "coding-agents" }));
    expect(register).not.toHaveBeenCalledWith(expect.objectContaining({ id: "git" }));
    expect(host.isActionActive("open_coding-agents" as ActionName)).toBe(true);
  });

  it("activates and deactivates on config changes (hot-reload)", () => {
    const host = makeHost({
      feature: { coding_agents: { mode: "on" }, git: { mode: "off" } },
    });
    register.mockClear();

    configSubject.next({ feature: { coding_agents: { mode: "off" }, git: { mode: "on" } } });

    expect(register).toHaveBeenCalledWith(expect.objectContaining({ id: "git" }));
    expect(unregister).toHaveBeenCalledWith(expect.objectContaining({ id: "coding-agents" }));
    expect(host.isActionActive("open_git" as ActionName)).toBe(true);
    expect(host.isActionActive("open_coding-agents" as ActionName)).toBe(false);
  });

  it("announces a reconciliation only once the feature states are current", () => {
    const host = makeHost({
      feature: { coding_agents: { mode: "on" }, git: { mode: "off" } },
    });
    const gitActiveWhenAnnounced: boolean[] = [];
    host.reconciled$.subscribe(() =>
      gitActiveWhenAnnounced.push(host.isActionActive("open_git" as ActionName)),
    );

    configSubject.next({ feature: { coding_agents: { mode: "on" }, git: { mode: "on" } } });

    expect(gitActiveWhenAnnounced).toEqual([false, true]);
  });
});
