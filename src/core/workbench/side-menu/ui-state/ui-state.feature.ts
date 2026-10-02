import { FeatureDefinition } from "@cogno/core/api/contributions";
import { sideMenuUiStateMigrations } from "./ui-state.migrations";

export const sideMenuUiStateFeature: FeatureDefinition = {
  mode: "on",
  target: "workbench",
  id: "side-menu-ui-state",
  migrations: sideMenuUiStateMigrations,
};
