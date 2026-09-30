import type { DestroyRef } from "@angular/core";
import type { ApplicationConfigurationPort } from "@cogno/core/api/application-configuration-port";
import type { FeatureDefinition } from "@cogno/core/api/contributions";
import type { DatabaseMigrationService } from "@cogno/core/infrastructure/database/database-migration.service";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { ActionNameRegistry } from "@cogno/core/workbench/actions/action-name-registry";
import type { ActionName } from "@cogno/core/workbench/bus/action.models";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureHost } from "./feature-host";
import type { NotificationChannelFeatureRegistrar } from "./notification-channel-feature-registrar";
import type { SideMenuFeatureRegistrar } from "./side-menu-feature-registrar";

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
  beforeEach(() => {
    vi.spyOn(ErrorReporter, "reportWarning").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const warn = () => vi.mocked(ErrorReporter.reportWarning);

  /** The conflicts the start-up message named, one per line after its heading. */
  function reportedConflicts(): string[] {
    return warn().mock.calls.flatMap(([report]) => report.message.split("\n").slice(1));
  }

  it("registers migrations and path adapters when the set is valid", () => {
    const migration = { id: "m1" } as never;
    const { registerFeatureMigrations } = makeHost([
      { id: "a", migrations: [migration] },
      { id: "b", requires: ["a"] },
    ]);

    expect(warn()).not.toHaveBeenCalled();
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
    const { registerFeatureMigrations } = makeHost([{ id: "dup" }, { id: "dup" }]);

    expect(reportedConflicts()).toContain("Feature declared twice: dup");
    expect(registerFeatureMigrations).not.toHaveBeenCalled();
  });

  it("aborts on an unknown requires", () => {
    makeHost([{ id: "a", requires: ["ghost"] }]);

    expect(reportedConflicts()).toContain('Feature "a" requires unknown feature: ghost');
  });

  it("aborts on a requires cycle", () => {
    makeHost([
      { id: "a", requires: ["b"] },
      { id: "b", requires: ["a"] },
    ]);

    expect(reportedConflicts().some((c) => c.startsWith("Cyclic requires:"))).toBe(true);
  });

  it("aborts on a settings path collision", () => {
    makeHost([
      { id: "a", settings: settingsWithPaths("feature") },
      { id: "b", settings: settingsWithPaths("feature") },
    ]);

    expect(reportedConflicts()).toContain("Settings path declared by two features: feature");
  });

  it("aborts on a duplicate action", () => {
    makeHost([
      { id: "a", actions: [{ actionName: "open_x" }] },
      { id: "b", actions: [{ actionName: "open_x" }] },
    ]);

    expect(reportedConflicts()).toContain("Action declared by two features: open_x");
  });

  it("offers no feature panels in the menu when the set did not start", () => {
    const { host } = makeHost([
      { id: "a", sideMenu: [{ actionName: "open_a", order: 1 }] as never },
      { id: "a" },
    ]);

    expect(host.getSideMenuFeatureDefinitions()).toEqual([]);
  });
});
