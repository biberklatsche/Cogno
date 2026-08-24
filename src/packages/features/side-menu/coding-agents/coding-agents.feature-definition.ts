import { SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";

export const codingAgentsFeatureId = "coding-agents";

export const codingAgentsSideMenuFeatureDefinition = {
  id: codingAgentsFeatureId,
  title: "Coding Agents",
  icon: "mdiRobot",
  order: 65,
  actionName: "open_coding_agents",
  configPath: "feature.coding_agents",
} as const satisfies SideMenuFeatureDefinitionContract;
