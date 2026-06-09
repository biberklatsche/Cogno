import { SideMenuFeatureDefinitionContract } from "@cogno/core-api";

export const codingAgentsFeatureId = "coding-agents";

export const codingAgentsSideMenuFeatureDefinition = {
  id: codingAgentsFeatureId,
  title: "Coding Agents",
  icon: "mdiRobot",
  order: 65,
  actionName: "open_coding_agents",
  configPath: "coding_agents",
} as const satisfies SideMenuFeatureDefinitionContract;
