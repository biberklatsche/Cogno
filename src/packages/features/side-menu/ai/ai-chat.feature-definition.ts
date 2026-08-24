import { SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";

export const aiChatFeatureId = "ai-chat";

export const aiChatSideMenuFeatureDefinition = {
  id: aiChatFeatureId,
  title: "AI Chat",
  icon: "mdiTooltipQuestion",
  order: 50,
  actionName: "open_ai_chat",
  configPath: "feature.ai",
} as const satisfies SideMenuFeatureDefinitionContract;
