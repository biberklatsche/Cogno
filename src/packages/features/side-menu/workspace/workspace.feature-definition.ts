import { SideMenuFeatureDefinitionContract } from "@cogno/core-api";

export const workspaceFeatureId = "workspace";

export const workspaceSideMenuFeatureDefinition = {
  id: workspaceFeatureId,
  title: "Workspace",
  icon: "mdiViewDashboard",
  order: 10,
  actionName: "open_workspace",
  configPath: "workspace",
} as const satisfies SideMenuFeatureDefinitionContract<string, string>;
