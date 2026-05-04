import { SideMenuFeatureDefinition } from "@cogno/app/menu/side-menu/+state/side-menu-feature-definitions";
import { hasUsableLlmProvider } from "@cogno/features/llm/llm-config";
import { CommandPaletteComponent } from "@cogno/features/side-menu/command-palette/command-palette.component";
import { commandPaletteSideMenuFeatureDefinition } from "@cogno/features/side-menu/command-palette/command-palette.feature-definition";
import { CommandPaletteSideMenuLifecycle } from "@cogno/features/side-menu/command-palette/command-palette-side-menu.lifecycle";
import { llmChatSideMenuFeatureDefinition } from "@cogno/features/side-menu/llm/llm-chat.feature-definition";
import { LlmChatSideComponent } from "@cogno/features/side-menu/llm/llm-chat-side.component";
import { LlmChatSideMenuLifecycle } from "@cogno/features/side-menu/llm/llm-chat-side-menu.lifecycle";
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
    ...llmChatSideMenuFeatureDefinition,
    targetComponent: LlmChatSideComponent,
    createLifecycle: (injector, sideMenuFeatureHandle) =>
      injector.get(LlmChatSideMenuLifecycle).create(sideMenuFeatureHandle),
    isAvailable: (configuration) => hasUsableLlmProvider(configuration),
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
