import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { FeatureDefinition } from "@cogno/shared/contributions";
import { FeatureModeContract } from "@cogno/shared/domain";

/**
 * A feature's runtime status (ARCHITECTURE.md 6.1). `degraded` is a live state
 * (a contribution threw but the feature is still registered); a contribution
 * that throws three times in a row opens the feature's circuit breaker and it
 * goes through deactivation to `failed`, left only by retry.
 */
export type FeatureRuntimeStatus =
  | "inactive"
  | "activating"
  | "active"
  | "deactivating"
  | "degraded"
  | "failed";

/** Consecutive failures of one contribution that open a feature's breaker (rule 5). */
const CONTRIBUTION_FAILURE_LIMIT = 3;

export interface FeatureRuntimeState {
  readonly id: string;
  readonly status: FeatureRuntimeStatus;
  /** Why a feature is inactive ("needs x") or failed (the error); undefined otherwise. */
  readonly reason?: string;
}

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
 * following the seven transition rules of ARCHITECTURE.md 6.1: one operation
 * per feature at a time, all-or-nothing activation with rollback, deactivation
 * that always ends in `inactive`, `requires` as a condition (dependents down
 * before their dependency), `failed` as an end-state left only by retry, and a
 * status that is never persisted.
 */
export class FeatureReconciler {
  private readonly byId: Map<string, FeatureDefinition<ActionName>>;
  private readonly status = new Map<string, FeatureRuntimeStatus>();
  private readonly reason = new Map<string, string | undefined>();
  private readonly inFlight = new Set<string>();
  private readonly consecutiveFailures = new Map<string, number>();
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

  stateOf(featureId: string): FeatureRuntimeState {
    return {
      id: featureId,
      status: this.status.get(featureId) ?? "inactive",
      reason: this.reason.get(featureId),
    };
  }

  states(): ReadonlyArray<FeatureRuntimeState> {
    return this.features.map((feature) => this.stateOf(feature.id));
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

  /** Retry a failed or degraded feature (rule 6): reset it, then reconcile. */
  retry(featureId: string): Promise<void> {
    this.consecutiveFailures.delete(featureId);
    const status = this.status.get(featureId);
    if (status === "failed") {
      this.status.set(featureId, "inactive");
      this.reason.delete(featureId);
    } else if (status === "degraded") {
      this.status.set(featureId, "active");
      this.reason.delete(featureId);
    }
    return this.reconcile();
  }

  /**
   * A contribution of `featureId` threw (rule 5). While the feature is running,
   * it goes `degraded`; three failures in a row open the breaker and the feature
   * is deactivated and left `failed`. A success resets the count.
   */
  reportContributionFailure(featureId: string): void {
    const status = this.status.get(featureId);
    if ((status !== "active" && status !== "degraded") || this.inFlight.has(featureId)) {
      return;
    }
    const failures = (this.consecutiveFailures.get(featureId) ?? 0) + 1;
    if (failures >= CONTRIBUTION_FAILURE_LIMIT) {
      this.consecutiveFailures.delete(featureId);
      void this.tripBreaker(featureId);
      return;
    }
    this.consecutiveFailures.set(featureId, failures);
    this.status.set(featureId, "degraded");
  }

  /** A contribution of `featureId` worked: clear the breaker count and un-degrade. */
  reportContributionSuccess(featureId: string): void {
    this.consecutiveFailures.delete(featureId);
    if (this.status.get(featureId) === "degraded") {
      this.status.set(featureId, "active");
      this.reason.delete(featureId);
    }
  }

  /** The breaker opened: deactivate the feature (rule 3), then leave it failed. */
  private async tripBreaker(featureId: string): Promise<void> {
    const feature = this.byId.get(featureId);
    if (!feature) {
      return;
    }
    await this.deactivate(feature, "failed");
    this.reason.set(featureId, "a contribution failed repeatedly");
    // A failed requirement takes its dependents down (rule 4).
    void this.reconcile();
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
        const isRunning = status === "active" || status === "degraded";
        if (wanted === "on" && status === "inactive" && this.requiresActive(feature)) {
          operations.push(this.activate(feature));
          progressed = true;
        } else if (isRunning && wanted === "off" && this.dependentsInactive(feature)) {
          operations.push(this.deactivate(feature));
          progressed = true;
        }
      }
      if (operations.length > 0) {
        await Promise.all(operations);
      }
    }
    this.updateInactiveReasons();
  }

  /** Rule 2: register (cannot fail), then activate(); on throw, roll back and fail. */
  private async activate(feature: FeatureDefinition<ActionName>): Promise<void> {
    this.inFlight.add(feature.id);
    this.status.set(feature.id, "activating");
    this.reason.delete(feature.id);
    try {
      this.registrar.register(feature);
      await feature.activate?.();
      this.status.set(feature.id, "active");
      this.consecutiveFailures.delete(feature.id);
    } catch (error) {
      this.registrar.unregister(feature);
      this.status.set(feature.id, "failed");
      this.reason.set(feature.id, describeError(error));
      this.reportError(feature.id, error);
    } finally {
      this.inFlight.delete(feature.id);
    }
  }

  /**
   * Rule 3: deactivate() first (contributions still there), then unregister.
   * Ends `inactive`, or `failed` when the breaker opened it (rule 5).
   */
  private async deactivate(
    feature: FeatureDefinition<ActionName>,
    finalStatus: "inactive" | "failed" = "inactive",
  ): Promise<void> {
    this.inFlight.add(feature.id);
    this.status.set(feature.id, "deactivating");
    try {
      await feature.deactivate?.();
    } catch (error) {
      this.reportError(feature.id, error);
    } finally {
      this.registrar.unregister(feature);
      this.status.set(feature.id, finalStatus);
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

  private updateInactiveReasons(): void {
    for (const feature of this.features) {
      const status = this.status.get(feature.id);
      if (status === "active") {
        this.reason.delete(feature.id);
        continue;
      }
      if (status !== "inactive" || this.desiredModeOf(feature) === "off") {
        continue;
      }
      const unmet = (feature.requires ?? []).find(
        (requiredId) => this.status.get(requiredId) !== "active",
      );
      if (unmet) {
        this.reason.set(feature.id, `needs ${unmet}`);
      } else {
        this.reason.delete(feature.id);
      }
    }
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
