import { ActionName } from "@cogno/app/action/action.models";
import { ApplicationProductContract } from "@cogno/core-api";
import { Icon } from "@cogno/core-ui";
import { featureApplicationFeatureCollection } from "@cogno/features";

export const product = {
  featureCollection: featureApplicationFeatureCollection,
} as const satisfies ApplicationProductContract<Icon, ActionName>;
