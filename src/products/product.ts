import type { ActionName } from "@cogno/app/action/action.models";
import type { ApplicationProductContract } from "@cogno/core-api";
import type { Icon } from "@cogno/core-ui";
import { productFeatureCollection } from "./product-feature-collection";

export const product = {
  featureCollection: productFeatureCollection,
} as const satisfies ApplicationProductContract<Icon, ActionName>;
