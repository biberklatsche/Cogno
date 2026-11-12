import {
  FeatureDefinition,
  SideMenuFeatureDefinitionContract,
} from "@cogno/core/api/contributions";
import { RemoteSideMenuLifecycle } from "./remote-side-menu.lifecycle";

const remoteFeatureId = "remote";

const remoteSideMenuFeatureDefinition = {
  id: remoteFeatureId,
  title: "Remote",
  icon: "mdiLaptop",
  order: 90,
  actionName: "open_remote",
  configPath: "feature.remote",
  targetComponent: () => import("./remote-side.component").then((m) => m.RemoteSideComponent),
  createLifecycle: (injector) => injector.get(RemoteSideMenuLifecycle).create(),
} as const satisfies SideMenuFeatureDefinitionContract;

export const remoteFeature: FeatureDefinition = {
  mode: "on",
  target: "workbench",
  id: remoteSideMenuFeatureDefinition.id,
  sideMenu: [remoteSideMenuFeatureDefinition],
};
