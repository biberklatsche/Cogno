import { FeatureDefinition, SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";
import { NotificationSideMenuLifecycle } from "./notification-side-menu.lifecycle";

export const notificationFeatureId = "notification";

export const notificationSideMenuFeatureDefinition = {
  id: notificationFeatureId,
  title: "Notification",
  icon: "mdiBell",
  order: 20,
  actionName: "open_notification",
  configPath: "feature.notification_overview",
  targetComponent: () =>
    import("./notification-side.component").then((m) => m.NotificationSideComponent),
  createLifecycle: (injector, sideMenuFeatureHandle) =>
    injector.get(NotificationSideMenuLifecycle).create(sideMenuFeatureHandle),
} as const satisfies SideMenuFeatureDefinitionContract;

export const notificationFeature: FeatureDefinition = {
  id: notificationSideMenuFeatureDefinition.id,
  sideMenu: [notificationSideMenuFeatureDefinition],
};
