import { FeatureDefinition, SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";
import { GitSideMenuLifecycle } from "./git-side-menu.lifecycle";

const gitFeatureId = "git";

const gitSideMenuFeatureDefinition = {
  id: gitFeatureId,
  title: "Git",
  icon: "mdiGit",
  order: 50,
  actionName: "open_git",
  configPath: "feature.git",
  targetComponent: () => import("./git-side.component").then((m) => m.GitSideComponent),
  createLifecycle: (injector, sideMenuFeatureHandle) =>
    injector.get(GitSideMenuLifecycle).create(sideMenuFeatureHandle),
} as const satisfies SideMenuFeatureDefinitionContract;

export const gitFeature: FeatureDefinition = {
  mode: "on",
  target: "session",
  id: gitSideMenuFeatureDefinition.id,
  sideMenu: [gitSideMenuFeatureDefinition],
};
