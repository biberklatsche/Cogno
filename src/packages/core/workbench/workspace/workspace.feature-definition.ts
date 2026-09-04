import { FeatureDefinition, SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";
import { workspaceDatabaseMigrations } from "./workspace.migrations";
import { WorkspaceSideMenuLifecycle } from "./workspace-side-menu.lifecycle";

export const workspaceFeatureId = "workspace";

export const workspaceSideMenuFeatureDefinition = {
  id: workspaceFeatureId,
  title: "Workspace",
  icon: "mdiViewDashboard",
  order: 10,
  actionName: "open_workspace",
  configPath: "feature.workspace",
  targetComponent: () => import("./workspace-side.component").then((m) => m.WorkspaceSideComponent),
  createLifecycle: (injector, sideMenuFeatureHandle) =>
    injector.get(WorkspaceSideMenuLifecycle).create(sideMenuFeatureHandle),
} as const satisfies SideMenuFeatureDefinitionContract;

export const workspaceFeature: FeatureDefinition = {
  mode: "on",
  target: "workbench",
  id: workspaceSideMenuFeatureDefinition.id,
  migrations: workspaceDatabaseMigrations,
  sideMenu: [workspaceSideMenuFeatureDefinition],
};
