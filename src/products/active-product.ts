import type { ProductDefinition } from "./product-definition";
import { communityProductDefinition } from "./community/community-product-definition";
import { proProductDefinition } from "./pro/pro-product-definition";

const productDefinitions = {
  community: communityProductDefinition,
  pro: proProductDefinition,
} as const satisfies Record<string, ProductDefinition>;

type ProductId = keyof typeof productDefinitions;

function readRequestedProductId(): ProductId {
  const requestedProductId = (import.meta as ImportMeta & {
    readonly env?: Record<string, string | undefined>;
  }).env?.["NG_APP_PRODUCT"];

  if (requestedProductId === "pro") {
    return "pro";
  }

  return "community";
}

export const activeProductDefinition = productDefinitions[readRequestedProductId()];
