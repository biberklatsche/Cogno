import { product } from "./product";
import { ProductDefinition } from "./product-definition";
import { productSideMenuFeatureDefinitions } from "./product-side-menu-feature-definitions";

export const productDefinition = {
  id: "cogno",
  applicationProduct: product,
  sideMenuFeatureDefinitions: productSideMenuFeatureDefinitions,
} as const satisfies ProductDefinition;
