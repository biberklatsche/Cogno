import { Type } from "@angular/core";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { ActionName } from "../../../action/action.models";
import { Icon } from "../../../icons/+model/icon";
import { NotificationSideComponent } from "../../../notification/notification-side/notification-side.component";
import { WorkspaceSideComponent } from "../../../workspace/workspace-side/workspace-side.component";
import { sideMenuFeatureIds } from "./side-menu-feature-ids";

export type SideMenuFeatureDefinition = SideMenuFeatureDefinitionContract<
  Type<unknown>,
  Icon,
  ActionName
>;

export const sideMenuFeatureDefinitions: ReadonlyArray<SideMenuFeatureDefinition> = [
  {
    id: sideMenuFeatureIds.workspace,
    title: "Workspace",
    icon: "mdiViewDashboard",
    order: 10,
    actionName: "open_workspace",
    targetComponent: WorkspaceSideComponent,
    configPath: "workspace",
  },
  {
    id: sideMenuFeatureIds.notification,
    title: "Notification",
    icon: "mdiBell",
    order: 20,
    actionName: "open_notification",
    targetComponent: NotificationSideComponent,
    configPath: "notification",
  },
];
