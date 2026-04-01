import type { ProductDefinition } from "../product-definition";
import { proProduct } from "./pro-product";
import { proSideMenuFeatureDefinitions } from "./pro-side-menu-feature-definitions";

export const proProductDefinition = {
  id: "pro",
  applicationProduct: proProduct,
  sideMenuFeatureDefinitions: proSideMenuFeatureDefinitions,
} as const satisfies ProductDefinition;
