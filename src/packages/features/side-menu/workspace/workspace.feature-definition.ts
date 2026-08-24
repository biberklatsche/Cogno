import { SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";

export const workspaceFeatureId = "workspace";

export const workspaceSideMenuFeatureDefinition = {
  id: workspaceFeatureId,
  title: "Workspace",
  icon: "mdiViewDashboard",
  order: 10,
  actionName: "open_workspace",
  configPath: "feature.workspace",
} as const satisfies SideMenuFeatureDefinitionContract;
