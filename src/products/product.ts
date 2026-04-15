import { ActionName } from "@cogno/app/action/action.models";
import { ApplicationProductContract } from "@cogno/core-api";
import { Icon } from "@cogno/core-ui";
import { productFeatureCollection } from "./product-feature-collection";

export const product = {
  featureCollection: productFeatureCollection,
} as const satisfies ApplicationProductContract<Icon, ActionName>;
