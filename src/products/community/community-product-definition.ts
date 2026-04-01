import type { ProductDefinition } from "../product-definition";
import { communityProduct } from "./community-product";
import { communitySideMenuFeatureDefinitions } from "./community-side-menu-feature-definitions";

export const communityProductDefinition = {
  id: "community",
  applicationProduct: communityProduct,
  sideMenuFeatureDefinitions: communitySideMenuFeatureDefinitions,
} as const satisfies ProductDefinition;
