import { FeatureDefinition } from "@cogno/shared/contributions";
import { sideMenuUiStateMigrations } from "./ui-state.migrations";

export const sideMenuUiStateFeature: FeatureDefinition = {
  id: "side-menu-ui-state",
  migrations: sideMenuUiStateMigrations,
};
