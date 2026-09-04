import { DestroyRef, Inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { DatabaseMigrationService } from "@cogno/core/infrastructure/database/database-migration.service";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { PathFactory } from "@cogno/core/session/exec/path.factory";
import { shellDefinitions } from "@cogno/core/session/shells/shell-definitions";
import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { FeatureDefinition } from "@cogno/shared/contributions";
import { FeatureModeContract, normalizeFeatureMode } from "@cogno/shared/domain";
import { ApplicationConfigurationPort } from "@cogno/shared/ports";
import { FEATURE_DEFINITIONS } from "./feature-definitions.token";
import { FeatureReconciler, FeatureRuntimeState } from "./feature-reconciler";
import { SideMenuFeatureRegistrar } from "./side-menu-feature-registrar";

/**
 * The one service that handles features (ARCHITECTURE.md 6.1). Its declaration
 * phase runs first: before the config that holds `mode` is read, it checks the
 * whole feature set for the errors a single declaration cannot catch -
 * duplicate ids, unknown or cyclic `requires`, colliding settings paths,
 * duplicate action names - and only then registers what must be known
 * independent of mode (schema migrations, shell path adapters). A conflict is a
 * programming error: the host registers nothing, the app starts with an empty
 * feature set, and the reasons are kept for the start-up message.
 *
 * Its activation phase then reconciles each feature's status against the mode
 * the config wants and re-reconciles on every config change (hot-reload). The
 * mode is read through the feature's existing `configPath`, whose key is not
 * always the feature id (ai-chat -> feature.ai, and so on) - the transition
 * state keeps the old contribution form (step 22b).
 */
@Injectable({ providedIn: "root" })
export class FeatureHost {
  private readonly declarationConflicts: ReadonlyArray<string>;
  private reconciler?: FeatureReconciler;
  private pendingReconcile = Promise.resolve();

  constructor(
    @Inject(FEATURE_DEFINITIONS)
    private readonly features: ReadonlyArray<FeatureDefinition<ActionName>>,
    private readonly databaseMigrationService: DatabaseMigrationService,
    private readonly sideMenuRegistrar: SideMenuFeatureRegistrar,
    private readonly applicationConfigurationPort: ApplicationConfigurationPort,
    private readonly destroyRef: DestroyRef,
  ) {
    this.declarationConflicts = findDeclarationConflicts(this.features);
    if (this.declarationConflicts.length > 0) {
      return;
    }
    this.declare();
    this.reconciler = new FeatureReconciler(
      this.features,
      this.sideMenuRegistrar,
      (feature) => this.desiredModeOf(feature),
      (featureId, error) => reportActivationError(featureId, error),
    );
    this.startActivation();
  }

  /** True when the feature set is inconsistent and the app started empty. */
  get hasDeclarationConflict(): boolean {
    return this.declarationConflicts.length > 0;
  }

  /** The conflicts that aborted the declaration, empty when there were none. */
  getDeclarationConflicts(): ReadonlyArray<string> {
    return this.declarationConflicts;
  }

  /** Each feature's runtime status, for the sidebar and the API (step 22d). */
  featureStates(): ReadonlyArray<FeatureRuntimeState> {
    return this.reconciler?.states() ?? [];
  }

  /** Resolves once the latest reconciliation has settled (for tests and startup). */
  whenSettled(): Promise<void> {
    return this.pendingReconcile;
  }

  private declare(): void {
    PathFactory.registerDefinitions(shellDefinitions.map((shell) => shell.pathAdapter));
    this.databaseMigrationService.registerFeatureMigrations(
      this.features.flatMap((feature) => feature.migrations ?? []),
    );
  }

  private startActivation(): void {
    this.applicationConfigurationPort.configuration$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.pendingReconcile = this.reconciler?.reconcile() ?? Promise.resolve();
      });
  }

  /**
   * The mode a feature is configured for: for a side-menu feature, read from
   * its `configPath` (whose key differs from the id for several features);
   * otherwise the feature's declared default.
   */
  private desiredModeOf(feature: FeatureDefinition<ActionName>): FeatureModeContract {
    const configPath = feature.sideMenu?.[0]?.configPath;
    if (!configPath) {
      return feature.mode;
    }
    const featureConfiguration = resolveConfigPath(
      this.applicationConfigurationPort.getConfiguration() as Record<string, unknown>,
      configPath,
    );
    if (typeof featureConfiguration !== "object" || featureConfiguration === null) {
      return feature.mode;
    }
    return normalizeFeatureMode((featureConfiguration as { mode?: unknown }).mode) ?? feature.mode;
  }
}

function resolveConfigPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (typeof value !== "object" || value === null) return undefined;
    return (value as Record<string, unknown>)[segment];
  }, source);
}

function reportActivationError(featureId: string, error: unknown): void {
  ErrorReporter.reportException({
    error,
    handled: true,
    source: "FeatureHost",
    context: { operation: "activate", featureId },
  });
}

/**
 * Every reason the feature set as a whole is invalid, each as its own message.
 * "Cannot fail" holds for a single declaration, never for the set.
 */
function findDeclarationConflicts(
  features: ReadonlyArray<FeatureDefinition<ActionName>>,
): ReadonlyArray<string> {
  return [
    ...findDuplicates(
      features.map((feature) => feature.id),
      (id) => `Feature declared twice: ${id}`,
    ),
    ...findUnknownRequires(features),
    ...findRequiresCycles(features),
    ...findDuplicates(
      features.flatMap((feature) => Object.keys(feature.settings?.schemaShape ?? {})),
      (path) => `Settings path declared by two features: ${path}`,
    ),
    ...findDuplicates(
      features.flatMap((feature) => (feature.actions ?? []).map((action) => action.actionName)),
      (actionName) => `Action declared by two features: ${actionName}`,
    ),
  ];
}

function findDuplicates(ids: ReadonlyArray<string>, message: (id: string) => string): string[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      duplicated.add(id);
    }
    seen.add(id);
  }
  return [...duplicated].map(message);
}

function findUnknownRequires(features: ReadonlyArray<FeatureDefinition<ActionName>>): string[] {
  const ids = new Set(features.map((feature) => feature.id));
  const conflicts: string[] = [];
  for (const feature of features) {
    for (const required of feature.requires ?? []) {
      if (!ids.has(required)) {
        conflicts.push(`Feature "${feature.id}" requires unknown feature: ${required}`);
      }
    }
  }
  return conflicts;
}

function findRequiresCycles(features: ReadonlyArray<FeatureDefinition<ActionName>>): string[] {
  const requiresById = new Map(
    features.map((feature) => [feature.id, feature.requires ?? []] as const),
  );
  const visiting = new Set<string>();
  const settled = new Set<string>();
  const cycles: string[] = [];

  const walk = (id: string, path: ReadonlyArray<string>): void => {
    if (settled.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      const cycleStart = path.indexOf(id);
      cycles.push(`Cyclic requires: ${[...path.slice(cycleStart), id].join(" -> ")}`);
      return;
    }
    visiting.add(id);
    for (const required of requiresById.get(id) ?? []) {
      // Unknown requires are reported separately; ignore them here.
      if (requiresById.has(required)) {
        walk(required, [...path, id]);
      }
    }
    visiting.delete(id);
    settled.add(id);
  };

  for (const feature of features) {
    walk(feature.id, []);
  }
  // The same cycle can be found from several entry points; report each once.
  return [...new Set(cycles)];
}
