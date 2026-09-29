import { InjectionToken } from "@angular/core";
import { FeatureDefinition } from "@cogno/core/api/contributions";
import { ActionName } from "@cogno/core/workbench/bus/action.models";

/**
 * The application's feature list, handed to the feature-host at startup.
 * `bootstrap/` provides the value (step 28 moves the manifest there); the
 * host reads it and never learns where it came from.
 */
export const FEATURE_DEFINITIONS = new InjectionToken<ReadonlyArray<FeatureDefinition<ActionName>>>(
  "FEATURE_DEFINITIONS",
);
