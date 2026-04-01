import type { ActionName } from "@cogno/app/action/action.models";
import type { ApplicationProductContract } from "@cogno/core-api";
import type { Icon } from "@cogno/core-ui";
import { communityFeatureCollection } from "./community-feature-collection";

export const communityProduct = {
  featureCollection: communityFeatureCollection,
} as const satisfies ApplicationProductContract<Icon, ActionName>;
