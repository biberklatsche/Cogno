import { SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";

export const gitFeatureId = "git";

export const gitSideMenuFeatureDefinition = {
  id: gitFeatureId,
  title: "Git",
  icon: "mdiGit",
  order: 50,
  actionName: "open_git",
  configPath: "feature.git",
} as const satisfies SideMenuFeatureDefinitionContract;
