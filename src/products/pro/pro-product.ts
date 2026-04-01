import type { ActionName } from "@cogno/app/action/action.models";
import type { ApplicationProductContract } from "@cogno/core-api";
import type { Icon } from "@cogno/core-ui";
import { proFeatureCollection } from "./pro-feature-collection";

export const proProduct = {
  featureCollection: proFeatureCollection,
} as const satisfies ApplicationProductContract<Icon, ActionName>;
