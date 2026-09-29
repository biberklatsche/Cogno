import { FeatureDefinition } from "@cogno/core/api/contributions";
import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { FeatureModeContract } from "@cogno/shared/domain";

/**
 * A feature's runtime status (ARCHITECTURE.md 6.1). `failed` means its
 * activation threw; it stays failed until the app restarts.
 */
export type FeatureRuntimeStatus = "inactive" | "activating" | "active" | "deactivating" | "failed";

/**
 * Where a feature's contributions are announced and withdrawn. Registration
 * cannot fail by construction (it only adds list entries); the consumers
 * (side-menu, action catalog, notification dispatch, suggestor registry) live
 * behind this so the reconciler stays pure.
 */
export interface FeatureContributionRegistrar {
  register(feature: FeatureDefinition<ActionName>): void;
  unregister(feature: FeatureDefinition<ActionName>): void;
}

/**
 * Reconciles each feature's actual status against the mode the config wants,
 * following the transition rules of ARCHITECTURE.md 6.1: one operation per
 * feature at a time, all-or-nothing activation with rollback, deactivation that
 * always ends in `inactive`, `requires` as a condition (dependents down before
 * their dependency), `failed` as an end-state, and a status that is never
 * persisted.
 */
export class FeatureReconciler {
  private readonly byId: Map<string, FeatureDefinition<ActionName>>;
  private readonly status = new Map<string, FeatureRuntimeStatus>();
  private readonly inFlight = new Set<string>();
  private running?: Promise<void>;
  private rerunRequested = false;

  constructor(
    private readonly features: ReadonlyArray<FeatureDefinition<ActionName>>,
    private readonly registrar: FeatureContributionRegistrar,
    private readonly desiredModeOf: (feature: FeatureDefinition<ActionName>) => FeatureModeContract,
    private readonly reportError: (featureId: string, error: unknown) => void = () => {},
  ) {
    this.byId = new Map(features.map((feature) => [feature.id, feature]));
    for (const feature of features) {
      this.status.set(feature.id, "inactive");
    }
  }

  statusOf(featureId: string): FeatureRuntimeStatus {
    return this.status.get(featureId) ?? "inactive";
  }

  /**
   * Bring every feature in line with the wanted modes. Serialised: a call made
   * while one is running requests a rerun instead of overlapping (rule 1).
   */
  reconcile(): Promise<void> {
    if (this.running) {
      this.rerunRequested = true;
      return this.running;
    }
    this.running = this.runReconcile().finally(() => {
      this.running = undefined;
      if (this.rerunRequested) {
        this.rerunRequested = false;
        void this.reconcile();
      }
    });
    return this.running;
  }

  private async runReconcile(): Promise<void> {
    let progressed = true;
    while (progressed) {
      progressed = false;
      const operations: Promise<void>[] = [];
      for (const feature of this.features) {
        if (this.inFlight.has(feature.id)) {
          continue;
        }
        const status = this.status.get(feature.id) ?? "inactive";
        const wanted = this.effectiveDesired(feature.id, new Set());
        if (wanted === "on" && status === "inactive" && this.requiresActive(feature)) {
          operations.push(this.activate(feature));
          progressed = true;
        } else if (status === "active" && wanted === "off" && this.dependentsInactive(feature)) {
          operations.push(this.deactivate(feature));
          progressed = true;
        }
      }
      if (operations.length > 0) {
        await Promise.all(operations);
      }
    }
  }

  /** Rule 2: register (cannot fail), then activate(); on throw, roll back and fail. */
  private async activate(feature: FeatureDefinition<ActionName>): Promise<void> {
    this.inFlight.add(feature.id);
    this.status.set(feature.id, "activating");
    try {
      this.registrar.register(feature);
      await feature.activate?.();
      this.status.set(feature.id, "active");
    } catch (error) {
      this.registrar.unregister(feature);
      this.status.set(feature.id, "failed");
      this.reportError(feature.id, error);
    } finally {
      this.inFlight.delete(feature.id);
    }
  }

  /** Rule 3: deactivate() first (contributions still there), then unregister. Ends `inactive`. */
  private async deactivate(feature: FeatureDefinition<ActionName>): Promise<void> {
    this.inFlight.add(feature.id);
    this.status.set(feature.id, "deactivating");
    try {
      await feature.deactivate?.();
    } catch (error) {
      this.reportError(feature.id, error);
    } finally {
      this.registrar.unregister(feature);
      this.status.set(feature.id, "inactive");
      this.inFlight.delete(feature.id);
    }
  }

  /**
   * The mode a feature effectively wants: off if its own mode is off, or if any
   * feature it requires (transitively) is off or failed (rule 4).
   */
  private effectiveDesired(featureId: string, seen: Set<string>): FeatureModeContract {
    const feature = this.byId.get(featureId);
    if (!feature || seen.has(featureId)) {
      return "off";
    }
    if (this.desiredModeOf(feature) === "off") {
      return "off";
    }
    seen.add(featureId);
    for (const requiredId of feature.requires ?? []) {
      if (!this.byId.has(requiredId) || this.status.get(requiredId) === "failed") {
        return "off";
      }
      if (this.effectiveDesired(requiredId, seen) === "off") {
        return "off";
      }
    }
    return "on";
  }

  private requiresActive(feature: FeatureDefinition<ActionName>): boolean {
    return (feature.requires ?? []).every((requiredId) => this.status.get(requiredId) === "active");
  }

  private dependentsInactive(feature: FeatureDefinition<ActionName>): boolean {
    return this.features
      .filter((candidate) => (candidate.requires ?? []).includes(feature.id))
      .every((dependent) => {
        const status = this.status.get(dependent.id);
        return status === "inactive" || status === "failed";
      });
  }
}
