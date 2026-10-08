import {
  FeatureDefinition,
  SideMenuFeatureDefinitionContract,
} from "@cogno/core/api/contributions";
import { UpdaterSideMenuLifecycle } from "./updater-side-menu.lifecycle";

const updaterSideMenuFeatureDefinition = {
  id: "updater",
  title: "Updates",
  icon: "mdiUpdate",
  order: 90,
  actionName: "open_updater",
  configPath: "feature.updater",
  targetComponent: () => import("./updater-side.component").then((m) => m.UpdaterSideComponent),
  createLifecycle: (injector, sideMenuFeatureHandle) =>
    injector.get(UpdaterSideMenuLifecycle).create(injector, sideMenuFeatureHandle),
} as const satisfies SideMenuFeatureDefinitionContract;

export const updaterFeature: FeatureDefinition = {
  mode: "on",
  target: "workbench",
  id: updaterSideMenuFeatureDefinition.id,
  sideMenu: [updaterSideMenuFeatureDefinition],
};
