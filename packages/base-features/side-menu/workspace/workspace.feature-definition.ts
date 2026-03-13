import { Type } from "@angular/core";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { WorkspaceSideComponent } from "./workspace-side.component";
import { WorkspaceSideMenuLifecycle } from "./workspace-side-menu.lifecycle";

export const workspaceFeatureId = "workspace";

export const workspaceSideMenuFeatureDefinition = {
  id: workspaceFeatureId,
  title: "Workspace",
  icon: "mdiViewDashboard",
  order: 10,
  actionName: "open_workspace",
  targetComponent: WorkspaceSideComponent,
  configPath: "workspace",
  createLifecycle: (injector, sideMenuFeatureHandle) =>
    injector.get(WorkspaceSideMenuLifecycle).create(sideMenuFeatureHandle),
} as const satisfies SideMenuFeatureDefinitionContract<Type<unknown>, string, string>;
