import type { DestroyRef } from "@angular/core";
import type { DatabaseMigrationService } from "@cogno/core/infrastructure/database/database-migration.service";
import { ActionNameRegistry } from "@cogno/core/workbench/actions/action-name-registry";
import type { ActionName } from "@cogno/core/workbench/bus/action.models";
import type { FeatureDefinition } from "@cogno/shared/contributions";
import type { ApplicationConfigurationPort } from "@cogno/shared/ports";
import { BehaviorSubject } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeatureHost } from "./feature-host";
import type { NotificationChannelFeatureRegistrar } from "./notification-channel-feature-registrar";
import type { SideMenuFeatureRegistrar } from "./side-menu-feature-registrar";
import type { SuggestorFeatureRegistrar } from "./suggestor-feature-registrar";

type FakeFeature = Partial<FeatureDefinition<ActionName>> & { id: string };

/** A feature with the declaration fields under test; mode/target are irrelevant here. */
function feature(partial: FakeFeature): FeatureDefinition<ActionName> {
  return { mode: "on", target: "workbench", ...partial };
}

function makeHost(features: ReadonlyArray<FakeFeature>): {
  host: FeatureHost;
  registerFeatureMigrations: ReturnType<typeof vi.fn>;
  actionNameRegistry: ActionNameRegistry;
} {
  const registerFeatureMigrations = vi.fn();
  const databaseMigrationService = {
    registerFeatureMigrations,
  } as unknown as DatabaseMigrationService;
  const actionNameRegistry = new ActionNameRegistry();
  const sideMenuRegistrar = {
    register: vi.fn(),
    unregister: vi.fn(),
  } as unknown as SideMenuFeatureRegistrar;
  const suggestorRegistrar = {
    register: vi.fn(),
    unregister: vi.fn(),
  } as unknown as SuggestorFeatureRegistrar;
  const notificationChannelRegistrar = {
    register: vi.fn(),
    unregister: vi.fn(),
  } as unknown as NotificationChannelFeatureRegistrar;
  const applicationConfigurationPort = {
    configuration$: new BehaviorSubject<Record<string, unknown>>({}),
    getConfiguration: () => ({}),
  } as unknown as ApplicationConfigurationPort;
  const destroyRef = { onDestroy: vi.fn(() => () => {}) } as unknown as DestroyRef;
  const host = new FeatureHost(
    features.map(feature),
    databaseMigrationService,
    actionNameRegistry,
    sideMenuRegistrar,
    suggestorRegistrar,
    notificationChannelRegistrar,
    applicationConfigurationPort,
    destroyRef,
  );
  return { host, registerFeatureMigrations, actionNameRegistry };
}

/** A settings extension whose only relevant part is which top-level paths it owns. */
function settingsWithPaths(...paths: string[]): FeatureDefinition["settings"] {
  const schemaShape = Object.fromEntries(paths.map((path) => [path, undefined]));
  return { schemaShape } as never;
}

describe("FeatureHost declaration phase", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers migrations and path adapters when the set is valid", () => {
    const migration = { id: "m1" } as never;
    const { host, registerFeatureMigrations } = makeHost([
      { id: "a", migrations: [migration] },
      { id: "b", requires: ["a"] },
    ]);

    expect(host.hasDeclarationConflict).toBe(false);
    expect(host.getDeclarationConflicts()).toEqual([]);
    expect(registerFeatureMigrations).toHaveBeenCalledWith([migration]);
  });

  it("registers feature action names for the catalogue", () => {
    const { actionNameRegistry } = makeHost([
      { id: "a", sideMenu: [{ actionName: "open_a" }] as never },
      { id: "b", actions: [{ actionName: "run_b" }] },
    ]);

    expect(actionNameRegistry.getActionNames()).toEqual(
      expect.arrayContaining(["open_a", "run_b"]),
    );
  });

  it("aborts on a duplicate feature id and registers nothing", () => {
    const { host, registerFeatureMigrations } = makeHost([{ id: "dup" }, { id: "dup" }]);

    expect(host.hasDeclarationConflict).toBe(true);
    expect(host.getDeclarationConflicts()).toContain("Feature declared twice: dup");
    expect(registerFeatureMigrations).not.toHaveBeenCalled();
  });

  it("aborts on an unknown requires", () => {
    const { host } = makeHost([{ id: "a", requires: ["ghost"] }]);

    expect(host.hasDeclarationConflict).toBe(true);
    expect(host.getDeclarationConflicts()).toContain('Feature "a" requires unknown feature: ghost');
  });

  it("aborts on a requires cycle", () => {
    const { host } = makeHost([
      { id: "a", requires: ["b"] },
      { id: "b", requires: ["a"] },
    ]);

    expect(host.hasDeclarationConflict).toBe(true);
    expect(host.getDeclarationConflicts().some((c) => c.startsWith("Cyclic requires:"))).toBe(true);
  });

  it("aborts on a settings path collision", () => {
    const { host } = makeHost([
      { id: "a", settings: settingsWithPaths("feature") },
      { id: "b", settings: settingsWithPaths("feature") },
    ]);

    expect(host.hasDeclarationConflict).toBe(true);
    expect(host.getDeclarationConflicts()).toContain(
      "Settings path declared by two features: feature",
    );
  });

  it("aborts on a duplicate action", () => {
    const { host } = makeHost([
      { id: "a", actions: [{ actionName: "open_x" }] },
      { id: "b", actions: [{ actionName: "open_x" }] },
    ]);

    expect(host.hasDeclarationConflict).toBe(true);
    expect(host.getDeclarationConflicts()).toContain("Action declared by two features: open_x");
  });
});
