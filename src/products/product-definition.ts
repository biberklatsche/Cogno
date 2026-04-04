import type { ActionName } from "@cogno/app/action/action.models";
import type { SideMenuFeatureDefinition } from "@cogno/app/menu/side-menu/+state/side-menu-feature-definitions";
import type { ApplicationProductContract } from "@cogno/core-api";
import type { Icon } from "@cogno/core-ui";

export interface ProductDefinition {
  readonly id: string;
  readonly applicationProduct: ApplicationProductContract<Icon, ActionName>;
  readonly sideMenuFeatureDefinitions: ReadonlyArray<SideMenuFeatureDefinition>;
}
