import { Injectable } from "@angular/core";
import { FeatureHost } from "@cogno/core/workbench/feature-host/feature-host";
import { ActionDispatcher } from "@cogno/shared/ports";
import { ActionNameRegistry } from "./action-name-registry";
import { toKnownCoreAction } from "./catalog";

/** The three-stage outcome of running an action by name (CLI/HTTP, step 26g). */
export type ActionRunStatus = "unknown" | "inactive" | "dispatched";

/**
 * Classifies and runs a catalogue action requested by name from outside the app
 * (CLI, HTTP). A core action is always available; a feature action is only
 * "dispatched" while its feature is active, "inactive" when the feature is off,
 * and anything neither core nor declared by a feature is "unknown".
 */
@Injectable({ providedIn: "root" })
export class ActionRunner {
  constructor(
    private readonly actionNameRegistry: ActionNameRegistry,
    private readonly featureHost: FeatureHost,
    private readonly dispatcher: ActionDispatcher,
  ) {}

  /** Classify without dispatching. */
  classify(actionName: string): ActionRunStatus {
    if (toKnownCoreAction(actionName)) {
      return "dispatched";
    }
    if (!this.actionNameRegistry.has(actionName)) {
      return "unknown";
    }
    return this.featureHost.isActionActive(actionName) ? "dispatched" : "inactive";
  }

  /** Classify and, when dispatchable, fire the action; returns the outcome. */
  run(actionName: string, args?: ReadonlyArray<string>): ActionRunStatus {
    const status = this.classify(actionName);
    if (status === "dispatched") {
      this.dispatcher.dispatchAction({ actionName, args: args ? [...args] : undefined });
    }
    return status;
  }
}
