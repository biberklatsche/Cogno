import { SideMenuFeatureDefinitionContract } from "@cogno/core-api";

export const gitFeatureId = "git";

export const gitSideMenuFeatureDefinition = {
  id: gitFeatureId,
  title: "Git",
  icon: "mdiGit",
  order: 50,
  actionName: "open_git",
  configPath: "git",
} as const satisfies SideMenuFeatureDefinitionContract<string, string>;
