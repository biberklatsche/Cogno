import { FeatureDefinition, SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";
import { CodingAgentsSideMenuLifecycle } from "./coding-agents-side-menu.lifecycle";

const codingAgentsFeatureId = "coding-agents";

const codingAgentsSideMenuFeatureDefinition = {
  id: codingAgentsFeatureId,
  title: "Coding Agents",
  icon: "mdiRobot",
  order: 65,
  actionName: "open_coding_agents",
  configPath: "feature.coding_agents",
  targetComponent: () =>
    import("./coding-agents-side.component").then((m) => m.CodingAgentsSideComponent),
  createLifecycle: (injector, sideMenuFeatureHandle) =>
    injector.get(CodingAgentsSideMenuLifecycle).create(injector, sideMenuFeatureHandle),
} as const satisfies SideMenuFeatureDefinitionContract;

export const codingAgentsFeature: FeatureDefinition = {
  mode: "on",
  target: "session",
  id: codingAgentsSideMenuFeatureDefinition.id,
  sideMenu: [codingAgentsSideMenuFeatureDefinition],
};
