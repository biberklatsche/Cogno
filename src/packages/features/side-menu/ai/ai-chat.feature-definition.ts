import { FeatureDefinition, SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";
import { AiChatSideMenuLifecycle } from "./ai-chat-side-menu.lifecycle";

export const aiChatFeatureId = "ai-chat";

export const aiChatSideMenuFeatureDefinition = {
  id: aiChatFeatureId,
  title: "AI Chat",
  icon: "mdiTooltipQuestion",
  order: 50,
  actionName: "open_ai_chat",
  configPath: "feature.ai",
  targetComponent: () => import("./ai-chat-side.component").then((m) => m.AiChatSideComponent),
  createLifecycle: (injector, sideMenuFeatureHandle) =>
    injector.get(AiChatSideMenuLifecycle).create(sideMenuFeatureHandle),
} as const satisfies SideMenuFeatureDefinitionContract;

export const aiChatFeature: FeatureDefinition = {
  id: aiChatSideMenuFeatureDefinition.id,
  sideMenu: [aiChatSideMenuFeatureDefinition],
};
