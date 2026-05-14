import { SideMenuFeatureDefinitionContract } from "@cogno/core-api";

export const aiChatFeatureId = "ai-chat";

export const aiChatSideMenuFeatureDefinition = {
  id: aiChatFeatureId,
  title: "AI Chat",
  icon: "mdiRobot",
  order: 50,
  actionName: "open_ai_chat",
  configPath: "ai",
} as const satisfies SideMenuFeatureDefinitionContract<string, string>;
