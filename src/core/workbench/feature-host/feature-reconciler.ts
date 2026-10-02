import { FeatureDefinition } from "@cogno/core/api/contributions";
import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { FeatureModeContract } from "@cogno/shared/domain";

/**
 * A feature's runtime status (ARCHITECTURE.md 6.1). `failed` means registering
 * its contributions threw; it stays failed until the app restarts.
 */
export type FeatureRuntimeStatus = "inactive" | "active" | "failed";

/**
 * Where a feature's contributions are announced and withdrawn. The consumers
 * (side-menu, notification channels) live behind this so the reconciler stays
 * pure. Registering can throw: a side-menu lifecycle runs the feature's own
 * code when it is told the feature is on.
 */
export interface FeatureContributionRegistrar {
  register(feature: FeatureDefinition<ActionName>): void;
  unregister(feature: FeatureDefinition<ActionName>): void;
}

/**
 * Reconciles each feature's actual status against the mode the config wants,
 * following the transition rules of ARCHITECTURE.md 6.1: all-or-nothing
 * activation with rollback, deactivation that always ends in `inactive`,
 * `requires` as a condition (dependents down before their dependency), `failed`
 * as an end-state, and a status that is never persisted. It runs synchronously:
 * registering is synchronous, so no change can come in between.
 */
export class FeatureReconciler {
  private readonly byId: Map<string, FeatureDefinition<ActionName>>;
  private readonly status = new Map<string, FeatureRuntimeStatus>();

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

  /** Brings every feature in line with the wanted modes. */
  reconcile(): void {
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const feature of this.features) {
        const status = this.statusOf(feature.id);
        const wanted = this.effectiveDesired(feature.id, new Set());
        if (wanted === "on" && status === "inactive" && this.requiresActive(feature)) {
          this.activate(feature);
          progressed = true;
        } else if (status === "active" && wanted === "off" && this.dependentsInactive(feature)) {
          this.deactivate(feature);
          progressed = true;
        }
      }
    }
  }

  /** Rule 1: register the contributions; on throw, roll back and fail. */
  private activate(feature: FeatureDefinition<ActionName>): void {
    try {
      this.registrar.register(feature);
      this.status.set(feature.id, "active");
    } catch (error) {
      this.registrar.unregister(feature);
      this.status.set(feature.id, "failed");
      this.reportError(feature.id, error);
    }
  }

  /**
   * Rule 2: unregister the contributions. Ends `inactive` even when the
   * feature's own code throws on the way out (its lifecycle is told `off`).
   */
  private deactivate(feature: FeatureDefinition<ActionName>): void {
    try {
      this.registrar.unregister(feature);
    } catch (error) {
      this.reportError(feature.id, error);
    }
    this.status.set(feature.id, "inactive");
  }

  /**
   * The mode a feature effectively wants: off if its own mode is off, or if any
   * feature it requires (transitively) is off or failed (rule 3).
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
