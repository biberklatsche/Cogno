import { FeatureDefinition, SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";
import { CodingAgentsSideMenuLifecycle } from "./coding-agents-side-menu.lifecycle";

export const codingAgentsFeatureId = "coding-agents";

export const codingAgentsSideMenuFeatureDefinition = {
  id: codingAgentsFeatureId,
  title: "Coding Agents",
  icon: "mdiRobot",
  order: 65,
  actionName: "open_coding_agents",
  configPath: "feature.coding_agents",
  targetComponent: () =>
    import("./coding-agents-side.component").then((m) => m.CodingAgentsSideComponent),
  createLifecycle: (injector, sideMenuFeatureHandle) =>
    injector.get(CodingAgentsSideMenuLifecycle).create(sideMenuFeatureHandle),
} as const satisfies SideMenuFeatureDefinitionContract;

export const codingAgentsFeature: FeatureDefinition = {
  mode: "on",
  target: "session",
  id: codingAgentsSideMenuFeatureDefinition.id,
  sideMenu: [codingAgentsSideMenuFeatureDefinition],
};
