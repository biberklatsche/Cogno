import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";

/** A side-menu entry as the app sees it: the contract with the app's action names. */
export type SideMenuFeatureDefinition = SideMenuFeatureDefinitionContract<ActionName>;
