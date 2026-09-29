import { SideMenuFeatureDefinitionContract } from "@cogno/core/api/contributions";
import { ActionName } from "@cogno/core/workbench/bus/action.models";

/** A side-menu entry as the app sees it: the contract with the app's action names. */
export type SideMenuFeatureDefinition = SideMenuFeatureDefinitionContract<ActionName>;
