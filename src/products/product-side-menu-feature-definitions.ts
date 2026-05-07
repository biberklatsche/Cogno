import { SideMenuFeatureDefinition } from "@cogno/app/menu/side-menu/+state/side-menu-feature-definitions";
import { hasUsableAiProvider } from "@cogno/features/ai/ai-config";
import { aiChatSideMenuFeatureDefinition } from "@cogno/features/side-menu/ai/ai-chat.feature-definition";
import { AiChatSideComponent } from "@cogno/features/side-menu/ai/ai-chat-side.component";
import { AiChatSideMenuLifecycle } from "@cogno/features/side-menu/ai/ai-chat-side-menu.lifecycle";
import { CommandPaletteComponent } from "@cogno/features/side-menu/command-palette/command-palette.component";
import { commandPaletteSideMenuFeatureDefinition } from "@cogno/features/side-menu/command-palette/command-palette.feature-definition";
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

export const productSideMenuFeatureDefinitions = [
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
    ...aiChatSideMenuFeatureDefinition,
    targetComponent: AiChatSideComponent,
    createLifecycle: (injector, sideMenuFeatureHandle) =>
      injector.get(AiChatSideMenuLifecycle).create(sideMenuFeatureHandle),
    isAvailable: (configuration) => hasUsableAiProvider(configuration),
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
