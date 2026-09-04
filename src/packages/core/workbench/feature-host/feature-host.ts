import { Inject, Injectable } from "@angular/core";
import { DatabaseMigrationService } from "@cogno/core/infrastructure/database/database-migration.service";
import { PathFactory } from "@cogno/core/session/exec/path.factory";
import { shellDefinitions } from "@cogno/core/session/shells/shell-definitions";
import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { FeatureDefinition } from "@cogno/shared/contributions";
import { FEATURE_DEFINITIONS } from "./feature-definitions.token";

/**
 * The one service that handles features. This is its declaration phase
 * (ARCHITECTURE.md 6.1, task 1): before the config that holds `mode` is read,
 * it checks the whole feature set for the errors a single declaration cannot
 * catch - duplicate ids, unknown or cyclic `requires`, colliding settings
 * paths, duplicate action names - and only then registers what must be known
 * independent of mode: the schema migrations and the shell path adapters.
 *
 * A conflict is a programming error, not a runtime state: the host registers
 * nothing, the app starts with an empty feature set, and the reason is kept
 * for the start-up message. Activation (step 22b) builds on this.
 */
@Injectable({ providedIn: "root" })
export class FeatureHost {
  private readonly declarationConflicts: ReadonlyArray<string>;

  constructor(
    @Inject(FEATURE_DEFINITIONS)
    private readonly features: ReadonlyArray<FeatureDefinition<ActionName>>,
    private readonly databaseMigrationService: DatabaseMigrationService,
  ) {
    this.declarationConflicts = findDeclarationConflicts(this.features);
    if (this.declarationConflicts.length === 0) {
      this.declare();
    }
  }

  /** True when the feature set is inconsistent and the app started empty. */
  get hasDeclarationConflict(): boolean {
    return this.declarationConflicts.length > 0;
  }

  /** The conflicts that aborted the declaration, empty when there were none. */
  getDeclarationConflicts(): ReadonlyArray<string> {
    return this.declarationConflicts;
  }

  private declare(): void {
    PathFactory.registerDefinitions(shellDefinitions.map((shell) => shell.pathAdapter));
    this.databaseMigrationService.registerFeatureMigrations(
      this.features.flatMap((feature) => feature.migrations ?? []),
    );
  }
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
