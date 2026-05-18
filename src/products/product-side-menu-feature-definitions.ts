import { SideMenuFeatureDefinition } from "@cogno/app/menu/side-menu/+state/side-menu-feature-definitions";
import { aiChatSideMenuFeatureDefinition } from "@cogno/features/side-menu/ai/ai-chat.feature-definition";
import { AiChatSideMenuLifecycle } from "@cogno/features/side-menu/ai/ai-chat-side-menu.lifecycle";
import { commandPaletteSideMenuFeatureDefinition } from "@cogno/features/side-menu/command-palette/command-palette.feature-definition";
import { CommandPaletteSideMenuLifecycle } from "@cogno/features/side-menu/command-palette/command-palette-side-menu.lifecycle";
import { gitSideMenuFeatureDefinition } from "@cogno/features/side-menu/git/git.feature-definition";
import { GitSideMenuLifecycle } from "@cogno/features/side-menu/git/git-side-menu.lifecycle";
import { notificationSideMenuFeatureDefinition } from "@cogno/features/side-menu/notification/notification.feature-definition";
import { NotificationSideMenuLifecycle } from "@cogno/features/side-menu/notification/notification-side-menu.lifecycle";
import { terminalSearchSideMenuFeatureDefinition } from "@cogno/features/side-menu/terminal-search/terminal-search.feature-definition";
import { TerminalSearchSideMenuLifecycle } from "@cogno/features/side-menu/terminal-search/terminal-search-side-menu.lifecycle";
import { workspaceSideMenuFeatureDefinition } from "@cogno/features/side-menu/workspace/workspace.feature-definition";
import { WorkspaceSideMenuLifecycle } from "@cogno/features/side-menu/workspace/workspace-side-menu.lifecycle";

export const productSideMenuFeatureDefinitions = [
  {
    ...workspaceSideMenuFeatureDefinition,
    targetComponent: () =>
      import("@cogno/features/side-menu/workspace/workspace-side.component").then(
        (m) => m.WorkspaceSideComponent,
      ),
    createLifecycle: (injector, sideMenuFeatureHandle) =>
      injector.get(WorkspaceSideMenuLifecycle).create(sideMenuFeatureHandle),
  },
  {
    ...commandPaletteSideMenuFeatureDefinition,
    targetComponent: () =>
      import("@cogno/features/side-menu/command-palette/command-palette.component").then(
        (m) => m.CommandPaletteComponent,
      ),
    createLifecycle: (injector, sideMenuFeatureHandle) =>
      injector.get(CommandPaletteSideMenuLifecycle).create(sideMenuFeatureHandle),
  },
  {
    ...aiChatSideMenuFeatureDefinition,
    targetComponent: () =>
      import("@cogno/features/side-menu/ai/ai-chat-side.component").then(
        (m) => m.AiChatSideComponent,
      ),
    createLifecycle: (injector, sideMenuFeatureHandle) =>
      injector.get(AiChatSideMenuLifecycle).create(sideMenuFeatureHandle),
  },
  {
    ...notificationSideMenuFeatureDefinition,
    targetComponent: () =>
      import("@cogno/features/side-menu/notification/notification-side.component").then(
        (m) => m.NotificationSideComponent,
      ),
    createLifecycle: (injector, sideMenuFeatureHandle) =>
      injector.get(NotificationSideMenuLifecycle).create(sideMenuFeatureHandle),
  },
  {
    ...terminalSearchSideMenuFeatureDefinition,
    targetComponent: () =>
      import("@cogno/features/side-menu/terminal-search/terminal-search-side.component").then(
        (m) => m.TerminalSearchSideComponent,
      ),
    createLifecycle: (injector, sideMenuFeatureHandle) =>
      injector.get(TerminalSearchSideMenuLifecycle).create(sideMenuFeatureHandle),
  },
  {
    ...gitSideMenuFeatureDefinition,
    targetComponent: () =>
      import("@cogno/features/side-menu/git/git-side.component").then(
        (m) => m.GitSideComponent,
      ),
    createLifecycle: (injector, sideMenuFeatureHandle) =>
      injector.get(GitSideMenuLifecycle).create(sideMenuFeatureHandle),
  },
] as const satisfies ReadonlyArray<SideMenuFeatureDefinition>;
