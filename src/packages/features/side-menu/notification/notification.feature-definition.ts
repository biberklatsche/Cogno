import { Type } from "@angular/core";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { NotificationSideComponent } from "./notification-side.component";
import { NotificationSideMenuLifecycle } from "./notification-side-menu.lifecycle";

export const notificationFeatureId = "notification";

export const notificationSideMenuFeatureDefinition = {
  id: notificationFeatureId,
  title: "Notification",
  icon: "mdiBell",
  order: 20,
  actionName: "open_notification",
  targetComponent: NotificationSideComponent,
  configPath: "notification",
  createLifecycle: (injector, sideMenuFeatureHandle) =>
    injector.get(NotificationSideMenuLifecycle).create(sideMenuFeatureHandle),
} as const satisfies SideMenuFeatureDefinitionContract<Type<unknown>, string, string>;
