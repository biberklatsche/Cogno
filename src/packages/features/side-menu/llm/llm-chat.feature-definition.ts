import { SideMenuFeatureDefinitionContract } from "@cogno/core-api";

export const llmChatFeatureId = "llm-chat";

export const llmChatSideMenuFeatureDefinition = {
  id: llmChatFeatureId,
  title: "LLM Chat",
  icon: "mdiRobot",
  order: 50,
  actionName: "open_llm_chat",
  configPath: "llm",
} as const satisfies SideMenuFeatureDefinitionContract<string, string>;
