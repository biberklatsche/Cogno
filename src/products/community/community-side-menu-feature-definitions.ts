import type { SideMenuFeatureDefinition } from "@cogno/app/menu/side-menu/+state/side-menu-feature-definitions";
import { commandPaletteSideMenuFeatureDefinition } from "@cogno/features/side-menu/command-palette/command-palette.feature-definition";
import { CommandPaletteComponent } from "@cogno/features/side-menu/command-palette/command-palette.component";
import { CommandPaletteSideMenuLifecycle } from "@cogno/features/side-menu/command-palette/command-palette-side-menu.lifecycle";
import { notificationSideMenuFeatureDefinition } from "@cogno/features/side-menu/notification/notification.feature-definition";
import { NotificationSideComponent } from "@cogno/features/side-menu/notification/notification-side.component";
import { NotificationSideMenuLifecycle } from "@cogno/features/side-menu/notification/notification-side-menu.lifecycle";
import { terminalSearchSideMenuFeatureDefinition } from "@cogno/features/side-menu/terminal-search/terminal-search.feature-definition";
import { TerminalSearchSideComponent } from "@cogno/features/side-menu/terminal-search/terminal-search-side.component";
import { TerminalSearchSideMenuLifecycle } from "@cogno/features/side-menu/terminal-search/terminal-search-side-menu.lifecycle";
import { workspaceSideMenuFeatureDefinition } from "@cogno/features/side-menu/workspace/workspace.feature-definition";
import { WorkspaceSideComponent } from "@cogno/features/side-menu/workspace/workspace-side.component";
import { WorkspaceSideMenuLifecycle } from "@cogno/features/side-menu/workspace/workspace-side-menu.lifecycle";

export const communitySideMenuFeatureDefinitions = [
  {
    ...workspaceSideMenuFeatureDefinition,
    targetComponent: WorkspaceSideComponent,
    createLifecycle: (injector, sideMenuFeatureHandle) =>
      injector.get(WorkspaceSideMenuLifecycle).create(sideMenuFeatureHandle),
  },
  {
    ...commandPaletteSideMenuFeatureDefinition,
    targetComponent: CommandPaletteComponent,
    createLifecycle: (injector, sideMenuFeatureHandle) =>
      injector.get(CommandPaletteSideMenuLifecycle).create(sideMenuFeatureHandle),
  },
  {
    ...notificationSideMenuFeatureDefinition,
    targetComponent: NotificationSideComponent,
    createLifecycle: (injector, sideMenuFeatureHandle) =>
      injector.get(NotificationSideMenuLifecycle).create(sideMenuFeatureHandle),
  },
  {
    ...terminalSearchSideMenuFeatureDefinition,
    targetComponent: TerminalSearchSideComponent,
    createLifecycle: (injector, sideMenuFeatureHandle) =>
      injector.get(TerminalSearchSideMenuLifecycle).create(sideMenuFeatureHandle),
  },
] as const satisfies ReadonlyArray<SideMenuFeatureDefinition>;
