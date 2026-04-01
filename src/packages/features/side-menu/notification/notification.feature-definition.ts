import { SideMenuFeatureDefinitionContract } from "@cogno/core-api";

export const notificationFeatureId = "notification";

export const notificationSideMenuFeatureDefinition = {
  id: notificationFeatureId,
  title: "Notification",
  icon: "mdiBell",
  order: 20,
  actionName: "open_notification",
  configPath: "notification",
} as const satisfies SideMenuFeatureDefinitionContract<string, string>;
