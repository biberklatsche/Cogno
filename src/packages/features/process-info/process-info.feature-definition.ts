import { FeatureDefinition, SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";
import { ProcessInfoSideMenuLifecycle } from "./process-info-side-menu.lifecycle";

export const processInfoFeatureId = "process-info";

export const processInfoSideMenuFeatureDefinition = {
  id: processInfoFeatureId,
  title: "Process Info",
  icon: "mdiInformation",
  order: 80,
  actionName: "open_process_info",
  configPath: "feature.process_info",
  targetComponent: () =>
    import("./process-info-side.component").then((m) => m.ProcessInfoSideComponent),
  createLifecycle: (injector, sideMenuFeatureHandle) =>
    injector.get(ProcessInfoSideMenuLifecycle).create(sideMenuFeatureHandle),
} as const satisfies SideMenuFeatureDefinitionContract;

export const processInfoFeature: FeatureDefinition = {
  mode: "on",
  target: "session",
  id: processInfoSideMenuFeatureDefinition.id,
  sideMenu: [processInfoSideMenuFeatureDefinition],
};
